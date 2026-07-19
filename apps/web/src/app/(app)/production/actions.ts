"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@zyntomax/db";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getSetting } from "@/lib/settings";
import { siteLocation, stageLocation, materialAvailable } from "@/lib/inventory";

export type FormState = { error?: string };

const jobSchema = z.object({
  siteId: z.string().min(1),
  stageId: z.string().min(1),
  materialTypeId: z.string().min(1), // the INPUT material
  weightInKg: z.coerce.number().positive("Weight must be positive"),
});

/**
 * Create a production job: consume `weightIn` of the input material from where
 * it lives (raw → intake; intermediate → the in-processing pool) into the
 * stage's active-work bucket. The stage must have a recipe for the input.
 */
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

  // The stage must know how to process this input material (a recipe exists)
  const recipe = await prisma.stageOutput.findFirst({
    where: { stageId, inputMaterialTypeId: materialTypeId, active: true },
  });
  if (!recipe) {
    return { error: "This stage has no recipe for that material. Define its outputs in Materials & Stages." };
  }

  const material = await prisma.materialType.findUniqueOrThrow({ where: { id: materialTypeId } });
  if (material.kind === "FINISHED") {
    return { error: "Finished goods can't be processed further." };
  }

  const available = await materialAvailable(siteId, materialTypeId);
  if (available < weightInKg) {
    return { error: `Only ${available.toFixed(1)} kg of ${material.name} is available to assign.` };
  }

  const source = await siteLocation(siteId, material.kind === "RAW" ? "INTAKE" : "IN_PROCESSING");
  const wip = await stageLocation(siteId, stageId);
  const tolerance = await getSetting<number>("production.tolerance_pct", 2, siteId);

  await prisma.$transaction(async (tx) => {
    const job = await tx.job.create({
      data: {
        siteId, stageId, materialTypeId, weightInKg,
        toleranceSnapshot: tolerance,
        status: "IN_PROGRESS",
        assignments: { create: staffIds.map((staffId) => ({ staffId, share: 1 / staffIds.length })) },
      },
    });
    await tx.inventoryMovement.create({
      data: {
        fromLocationId: source.id,
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

  await audit({
    actorId: session.userId,
    action: "job.create",
    entity: "Job",
    entityId: `${stageId}:${materialTypeId}`,
    after: { weightInKg },
  });
  revalidatePath("/production");
  revalidatePath("/inventory");
  return {};
}

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

  // Output lines: repeated outputMaterialTypeId[] + outWeight[]
  const outputIds = formData.getAll("outputMaterialTypeId").map(String);
  const outWeights = formData.getAll("outWeight").map(Number);
  const outputLines = outputIds
    .map((id, i) => ({ outputMaterialTypeId: id, weightKg: outWeights[i] }))
    .filter((l) => l.outputMaterialTypeId && l.weightKg > 0);

  if (outputLines.length === 0) {
    return { error: "Enter the weight of at least one output material." };
  }

  // Validate every output is a valid recipe output for (stage, input)
  const validOutputs = new Set(
    (await prisma.stageOutput.findMany({
      where: { stageId: job.stageId, inputMaterialTypeId: job.materialTypeId, active: true },
      select: { outputMaterialTypeId: true },
    })).map((r) => r.outputMaterialTypeId),
  );
  if (outputLines.some((l) => !validOutputs.has(l.outputMaterialTypeId))) {
    return { error: "An output material is not valid for this stage." };
  }

  const weightOutKg = outputLines.reduce((s, l) => s + l.weightKg, 0);
  if (Number.isNaN(wasteKg) || wasteKg < 0) return { error: "Enter a valid waste weight." };

  const weightIn = Number(job.weightInKg);
  if (weightOutKg + wasteKg > weightIn * 1.5) {
    return { error: "Output + waste is implausibly higher than the scaled-in weight. Check the figures." };
  }
  const discrepancy = weightIn - weightOutKg - wasteKg;
  const discrepancyPct = weightIn > 0 ? (discrepancy / weightIn) * 100 : 0;
  const beyondTolerance = Math.abs(discrepancyPct) > Number(job.toleranceSnapshot);

  // Record the output composition
  await prisma.jobOutput.deleteMany({ where: { jobId } });
  await prisma.jobOutput.createMany({
    data: outputLines.map((l) => ({ jobId, outputMaterialTypeId: l.outputMaterialTypeId, weightKg: l.weightKg })),
  });

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
    await audit({ actorId: session.userId, action: "job.flag", entity: "Job", entityId: jobId, after: { weightOutKg, wasteKg, discrepancyPct } });
    revalidatePath("/production");
    return {};
  }

  await moveJobOutput(jobId, wasteKg, discrepancy, session.userId, "COMPLETED");
  await audit({ actorId: session.userId, action: "job.complete", entity: "Job", entityId: jobId, after: { weightOutKg, wasteKg, discrepancyPct } });
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

  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId }, include: { assignments: true } });
  if (job.status !== "FLAGGED") return { error: "This job is not flagged." };

  const discrepancy = Number(job.weightInKg) - Number(job.weightOutKg ?? 0) - Number(job.wasteKg ?? 0);

  if (resolution !== "OVERLOOK" && discrepancy > 0) {
    const rate = await prisma.vendorRate.findFirst({
      where: { materialTypeId: job.materialTypeId },
      orderBy: { effectiveFrom: "desc" },
    });
    const chargeTotal = discrepancy * (rate ? Number(rate.pricePerKg) : 0);
    if (chargeTotal > 0) {
      if (resolution === "CHARGE_SUPERVISOR") {
        const supervisor = await prisma.staffProfile.findUnique({ where: { userId: session.userId } });
        if (supervisor) await prisma.discrepancyCharge.create({ data: { jobId, staffId: supervisor.id, amount: chargeTotal, reason } });
      } else {
        for (const a of job.assignments) {
          await prisma.discrepancyCharge.create({
            data: { jobId, staffId: a.staffId, amount: Math.round(chargeTotal * Number(a.share) * 100) / 100, reason },
          });
        }
      }
    }
  }

  await moveJobOutput(
    jobId, Number(job.wasteKg ?? 0), discrepancy, session.userId, "RESOLVED",
    `${reason}${resolution !== "OVERLOOK" ? ` [${resolution === "CHARGE_SUPERVISOR" ? "charged supervisor" : "charged staff"}]` : ""}`,
  );
  await audit({ actorId: session.userId, action: "job.resolve", entity: "Job", entityId: jobId, after: { reason, resolution } });
  revalidatePath("/production");
  revalidatePath("/inventory");
  revalidatePath("/payroll");
  return {};
}

/**
 * Move a job's materials on completion/resolution: the input material is
 * consumed from the stage's active bucket and transformed into each output
 * material, which lands in its bucket (intermediate → in-processing pool;
 * finished → finished store). Waste and unaccounted loss → waste.
 * Mass-balanced: the input's active-bucket balance returns to zero.
 */
async function moveJobOutput(
  jobId: string,
  wasteKg: number,
  discrepancy: number,
  actorId: string,
  finalStatus: "COMPLETED" | "RESOLVED",
  resolutionNote?: string,
) {
  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
  const wip = await stageLocation(job.siteId, job.stageId);
  const waste = await siteLocation(job.siteId, "WASTE");
  const inProcessing = await siteLocation(job.siteId, "IN_PROCESSING");
  const finished = await siteLocation(job.siteId, "FINISHED_STORE");

  const outputs = await prisma.jobOutput.findMany({
    where: { jobId },
    include: { outputMaterial: true },
  });
  const weightOutKg = outputs.reduce((s, o) => s + Number(o.weightKg), 0);

  await prisma.$transaction(async (tx) => {
    // Gain (out + waste > in): top up the active bucket so it can't go negative
    if (discrepancy < 0) {
      await tx.inventoryMovement.create({
        data: {
          toLocationId: wip.id, materialTypeId: job.materialTypeId, weightKg: -discrepancy,
          refType: "ADJUSTMENT", refId: jobId, byId: actorId, note: "Scale gain adjustment",
        },
      });
    }

    // Transform: consume input from active bucket, produce each output material
    for (const o of outputs) {
      const w = Number(o.weightKg);
      if (w <= 0) continue;
      await tx.inventoryMovement.create({
        data: {
          fromLocationId: wip.id, materialTypeId: job.materialTypeId, weightKg: w,
          refType: "JOB", refId: jobId, byId: actorId, note: `Transformed into ${o.outputMaterial.name}`,
        },
      });
      await tx.inventoryMovement.create({
        data: {
          toLocationId: o.outputMaterial.kind === "FINISHED" ? finished.id : inProcessing.id,
          materialTypeId: o.outputMaterialTypeId, weightKg: w, lotNo: job.lotNo,
          refType: "JOB", refId: jobId, byId: actorId,
          note: `Produced ${o.outputMaterial.name}`,
        },
      });
    }

    if (wasteKg > 0) {
      await tx.inventoryMovement.create({
        data: {
          fromLocationId: wip.id, toLocationId: waste.id, materialTypeId: job.materialTypeId,
          weightKg: wasteKg, refType: "JOB", refId: jobId, byId: actorId, note: "Process waste",
        },
      });
    }
    if (discrepancy > 0) {
      await tx.inventoryMovement.create({
        data: {
          fromLocationId: wip.id, toLocationId: waste.id, materialTypeId: job.materialTypeId,
          weightKg: discrepancy, refType: "JOB", refId: jobId, byId: actorId,
          note: resolutionNote ? `Unaccounted loss — ${resolutionNote}` : "Within-tolerance loss",
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
        ...(resolutionNote ? { resolvedById: actorId, flagReason: resolutionNote } : {}),
      },
    });
  });
}
