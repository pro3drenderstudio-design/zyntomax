"use server";

import { revalidatePath } from "next/cache";
import { prisma, Prisma } from "@zyntomax/db";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getSetting } from "@/lib/settings";
import { siteLocation, stageLocation } from "@/lib/inventory";

export type FormState = { error?: string };

async function locationBalance(locationId: string, materialTypeId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ balance: number }[]>(Prisma.sql`
    SELECT COALESCE(SUM(
      CASE WHEN "toLocationId" = ${locationId} THEN "weightKg" ELSE -"weightKg" END
    ), 0) AS balance
    FROM "InventoryMovement"
    WHERE ("toLocationId" = ${locationId} OR "fromLocationId" = ${locationId})
      AND "materialTypeId" = ${materialTypeId}
  `);
  return Number(rows[0]?.balance ?? 0);
}

const jobSchema = z.object({
  siteId: z.string().min(1),
  stageId: z.string().min(1),
  materialTypeId: z.string().min(1),
  weightInKg: z.coerce.number().positive("Weight must be positive"),
});

export async function createJob(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["FACTORY_SUPERVISOR", "OPERATIONS_MANAGER"]);
  const parsed = jobSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { siteId, stageId, materialTypeId, weightInKg } = parsed.data;

  const staffIds = formData.getAll("staffIds").map(String).filter(Boolean);
  if (staffIds.length === 0) return { error: "Assign at least one staff member." };

  const route = await prisma.materialRoute.findMany({
    where: { materialTypeId },
    orderBy: { sequence: "asc" },
  });
  const routeIndex = route.findIndex((r) => r.stageId === stageId);
  if (routeIndex === -1) {
    return { error: "This stage is not on the selected material's route. Set it up in Materials & Stages." };
  }
  const isFirstStage = routeIndex === 0;

  const wip = await stageLocation(siteId, stageId);
  const tolerance = await getSetting<number>("production.tolerance_pct", 2, siteId);

  if (isFirstStage) {
    const intake = await siteLocation(siteId, "INTAKE");
    const available = await locationBalance(intake.id, materialTypeId);
    if (available < weightInKg) {
      return { error: `Only ${available.toFixed(1)} kg of this material is available at intake.` };
    }
    await prisma.$transaction(async (tx) => {
      const job = await tx.job.create({
        data: {
          siteId, stageId, materialTypeId, weightInKg,
          toleranceSnapshot: tolerance,
          status: "IN_PROGRESS",
          assignments: {
            create: staffIds.map((staffId) => ({ staffId, share: 1 / staffIds.length })),
          },
        },
      });
      await tx.inventoryMovement.create({
        data: {
          fromLocationId: intake.id,
          toLocationId: wip.id,
          materialTypeId,
          weightKg: weightInKg,
          refType: "JOB",
          refId: job.id,
          byId: session.userId,
          note: "Assigned to job",
        },
      });
    });
  } else {
    // Material is already in this stage's WIP (moved by the previous stage's completion)
    const wipBalance = await locationBalance(wip.id, materialTypeId);
    const activeJobs = await prisma.job.aggregate({
      _sum: { weightInKg: true },
      where: { siteId, stageId, materialTypeId, status: { in: ["ASSIGNED", "IN_PROGRESS", "FLAGGED"] } },
    });
    const unassigned = wipBalance - Number(activeJobs._sum.weightInKg ?? 0);
    if (unassigned < weightInKg) {
      return { error: `Only ${Math.max(0, unassigned).toFixed(1)} kg is waiting at this stage (not yet assigned to a job).` };
    }
    await prisma.job.create({
      data: {
        siteId, stageId, materialTypeId, weightInKg,
        toleranceSnapshot: tolerance,
        status: "IN_PROGRESS",
        assignments: {
          create: staffIds.map((staffId) => ({ staffId, share: 1 / staffIds.length })),
        },
      },
    });
  }

  revalidatePath("/production");
  revalidatePath("/inventory");
  return {};
}

const completeSchema = z.object({
  jobId: z.string().min(1),
  weightOutKg: z.coerce.number().min(0),
  wasteKg: z.coerce.number().min(0),
});

export async function completeJob(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["FACTORY_SUPERVISOR", "OPERATIONS_MANAGER"]);
  const jobId = String(formData.get("jobId") ?? "");
  const wasteKg = Number(formData.get("wasteKg") ?? 0);

  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
  if (!["ASSIGNED", "IN_PROGRESS"].includes(job.status)) {
    return { error: "This job is not open." };
  }

  // Categorized outputs: repeated stageOutputId[] + outWeight[]. When a stage
  // has defined outputs the form posts lines; otherwise a single weightOutKg.
  const outputIds = formData.getAll("stageOutputId").map(String).filter(Boolean);
  const outWeights = formData.getAll("outWeight").map(Number);
  const outputLines = outputIds
    .map((id, i) => ({ stageOutputId: id, weightKg: outWeights[i] }))
    .filter((l) => l.weightKg > 0);

  const weightOutKg =
    outputLines.length > 0
      ? outputLines.reduce((s, l) => s + l.weightKg, 0)
      : Number(formData.get("weightOutKg") ?? 0);

  if (Number.isNaN(wasteKg) || wasteKg < 0 || Number.isNaN(weightOutKg) || weightOutKg < 0) {
    return { error: "Enter valid output and waste weights." };
  }

  const weightIn = Number(job.weightInKg);
  const accounted = weightOutKg + wasteKg;
  if (accounted > weightIn * 1.5) {
    return { error: "Output + waste is implausibly higher than the scaled-in weight. Check the figures." };
  }
  const discrepancy = weightIn - accounted;
  const discrepancyPct = weightIn > 0 ? (discrepancy / weightIn) * 100 : 0;
  const beyondTolerance = Math.abs(discrepancyPct) > Number(job.toleranceSnapshot);

  // Record the output composition (color-tagged breakdown) either way
  if (outputLines.length > 0) {
    await prisma.jobOutput.deleteMany({ where: { jobId } });
    await prisma.jobOutput.createMany({
      data: outputLines.map((l) => ({ jobId, stageOutputId: l.stageOutputId, weightKg: l.weightKg })),
    });
  }

  if (beyondTolerance) {
    await prisma.job.update({
      where: { id: jobId },
      data: {
        weightOutKg, wasteKg,
        status: "FLAGGED",
        flagReason: `Discrepancy ${discrepancyPct.toFixed(1)}% exceeds ±${Number(job.toleranceSnapshot)}% tolerance`,
        completedAt: new Date(),
      },
    });
    await audit({
      actorId: session.userId,
      action: "job.flag",
      entity: "Job",
      entityId: jobId,
      after: { weightOutKg, wasteKg, discrepancyPct },
    });
    revalidatePath("/production");
    return {};
  }

  await moveJobOutput(jobId, weightOutKg, wasteKg, discrepancy, session.userId, "COMPLETED");
  await audit({
    actorId: session.userId,
    action: "job.complete",
    entity: "Job",
    entityId: jobId,
    after: { weightOutKg, wasteKg, discrepancyPct },
  });
  revalidatePath("/production");
  revalidatePath("/inventory");
  return {};
}

export async function resolveJob(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["FACTORY_SUPERVISOR", "OPERATIONS_MANAGER"]);
  const jobId = String(formData.get("jobId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const resolution = String(formData.get("resolution") ?? "OVERLOOK") as
    | "OVERLOOK" | "CHARGE_SUPERVISOR" | "CHARGE_STAFF";
  if (!reason) return { error: "A resolution note is required for flagged jobs." };

  const job = await prisma.job.findUniqueOrThrow({
    where: { id: jobId },
    include: { assignments: true },
  });
  if (job.status !== "FLAGGED") return { error: "This job is not flagged." };

  const discrepancy =
    Number(job.weightInKg) - Number(job.weightOutKg ?? 0) - Number(job.wasteKg ?? 0);

  // Charge-back is valued at the material's cost per kg (latest vendor rate proxy).
  if (resolution !== "OVERLOOK" && discrepancy > 0) {
    const rate = await prisma.vendorRate.findFirst({
      where: { materialTypeId: job.materialTypeId },
      orderBy: { effectiveFrom: "desc" },
    });
    const unitCost = rate ? Number(rate.pricePerKg) : 0;
    const chargeTotal = discrepancy * unitCost;

    if (chargeTotal > 0) {
      if (resolution === "CHARGE_SUPERVISOR") {
        const supervisor = await prisma.staffProfile.findUnique({
          where: { userId: session.userId },
        });
        if (supervisor) {
          await prisma.discrepancyCharge.create({
            data: { jobId, staffId: supervisor.id, amount: chargeTotal, reason },
          });
        }
      } else {
        // Split across assigned staff by their job share
        for (const a of job.assignments) {
          await prisma.discrepancyCharge.create({
            data: {
              jobId,
              staffId: a.staffId,
              amount: Math.round(chargeTotal * Number(a.share) * 100) / 100,
              reason,
            },
          });
        }
      }
    }
  }

  await moveJobOutput(
    jobId,
    Number(job.weightOutKg ?? 0),
    Number(job.wasteKg ?? 0),
    discrepancy,
    session.userId,
    "RESOLVED",
    `${reason}${resolution !== "OVERLOOK" ? ` [${resolution === "CHARGE_SUPERVISOR" ? "charged supervisor" : "charged staff"}]` : ""}`,
  );
  await audit({
    actorId: session.userId,
    action: "job.resolve",
    entity: "Job",
    entityId: jobId,
    after: { reason, resolution },
  });
  revalidatePath("/production");
  revalidatePath("/inventory");
  revalidatePath("/payroll");
  return {};
}

/** Shared movement logic for job completion/resolution. */
async function moveJobOutput(
  jobId: string,
  weightOutKg: number,
  wasteKg: number,
  discrepancy: number,
  actorId: string,
  finalStatus: "COMPLETED" | "RESOLVED",
  resolutionNote?: string,
) {
  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
  const route = await prisma.materialRoute.findMany({
    where: { materialTypeId: job.materialTypeId },
    orderBy: { sequence: "asc" },
  });
  const routeIndex = route.findIndex((r) => r.stageId === job.stageId);
  const isLastStage = routeIndex === route.length - 1;

  const wip = await stageLocation(job.siteId, job.stageId);
  const waste = await siteLocation(job.siteId, "WASTE");

  await prisma.$transaction(async (tx) => {
    // Gain (out + waste > in): balance the WIP with an adjustment first
    if (discrepancy < 0) {
      await tx.inventoryMovement.create({
        data: {
          toLocationId: wip.id,
          materialTypeId: job.materialTypeId,
          weightKg: -discrepancy,
          refType: "ADJUSTMENT",
          refId: jobId,
          byId: actorId,
          note: "Scale gain adjustment on job completion",
        },
      });
    }

    if (weightOutKg > 0) {
      const jobOutputs = await tx.jobOutput.findMany({
        where: { jobId },
        include: { stageOutput: true },
      });
      const store = await tx.inventoryLocation.findFirstOrThrow({
        where: { siteId: job.siteId, kind: "FINISHED_STORE" },
      });

      if (jobOutputs.length > 0) {
        // Stage defines named outputs (e.g. sorted PP, HDPE): transform the
        // input material into each output, held as stock in the finished store.
        for (const o of jobOutputs) {
          const w = Number(o.weightKg);
          if (w <= 0) continue;
          await tx.inventoryMovement.create({
            data: {
              fromLocationId: wip.id,
              materialTypeId: job.materialTypeId,
              weightKg: w,
              refType: "JOB",
              refId: jobId,
              byId: actorId,
              note: `Sorted into ${o.stageOutput.name}`,
            },
          });
          await tx.inventoryMovement.create({
            data: {
              toLocationId: store.id,
              stageOutputId: o.stageOutputId,
              weightKg: w,
              lotNo: job.lotNo,
              refType: "JOB",
              refId: jobId,
              byId: actorId,
              note: `Output: ${o.stageOutput.name}`,
            },
          });
        }
      } else if (isLastStage) {
        // Finished goods — convert material into its product
        const product = await tx.product.findFirst({
          where: { materialTypeId: job.materialTypeId, active: true },
        });
        if (product) {
          await tx.inventoryMovement.create({
            data: {
              fromLocationId: wip.id,
              materialTypeId: job.materialTypeId,
              weightKg: weightOutKg,
              refType: "JOB",
              refId: jobId,
              byId: actorId,
              note: `Converted to ${product.name}`,
            },
          });
          await tx.inventoryMovement.create({
            data: {
              toLocationId: store.id,
              productId: product.id,
              weightKg: weightOutKg,
              lotNo: job.lotNo,
              refType: "JOB",
              refId: jobId,
              byId: actorId,
              note: `Finished: ${product.name}`,
            },
          });
        } else {
          await tx.inventoryMovement.create({
            data: {
              fromLocationId: wip.id,
              toLocationId: store.id,
              materialTypeId: job.materialTypeId,
              weightKg: weightOutKg,
              lotNo: job.lotNo,
              refType: "JOB",
              refId: jobId,
              byId: actorId,
              note: "Finished goods",
            },
          });
        }
      } else {
        const nextWip = await stageLocation(job.siteId, route[routeIndex + 1].stageId);
        await tx.inventoryMovement.create({
          data: {
            fromLocationId: wip.id,
            toLocationId: nextWip.id,
            materialTypeId: job.materialTypeId,
            weightKg: weightOutKg,
            lotNo: job.lotNo,
            refType: "JOB",
            refId: jobId,
            byId: actorId,
            note: "Stage output → next stage",
          },
        });
      }
    }

    if (wasteKg > 0) {
      await tx.inventoryMovement.create({
        data: {
          fromLocationId: wip.id,
          toLocationId: waste.id,
          materialTypeId: job.materialTypeId,
          weightKg: wasteKg,
          refType: "JOB",
          refId: jobId,
          byId: actorId,
          note: "Process waste",
        },
      });
    }

    if (discrepancy > 0) {
      await tx.inventoryMovement.create({
        data: {
          fromLocationId: wip.id,
          toLocationId: waste.id,
          materialTypeId: job.materialTypeId,
          weightKg: discrepancy,
          refType: "JOB",
          refId: jobId,
          byId: actorId,
          note: resolutionNote
            ? `Unaccounted loss — ${resolutionNote}`
            : "Within-tolerance loss",
        },
      });
    }

    await tx.job.update({
      where: { id: jobId },
      data: {
        weightOutKg,
        wasteKg,
        status: finalStatus,
        completedAt: new Date(),
        ...(resolutionNote ? { resolvedById: actorId, flagReason: `${resolutionNote}` } : {}),
      },
    });
  });
}
