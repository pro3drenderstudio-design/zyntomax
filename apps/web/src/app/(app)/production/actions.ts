"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@zyntomax/db";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { createProductionJob, completeProductionJob, moveJobOutput } from "@/lib/production";

export type FormState = { error?: string };

const jobSchema = z.object({
  siteId: z.string().min(1),
  stageId: z.string().min(1),
  materialTypeId: z.string().min(1), // the INPUT material
  weightInKg: z.coerce.number().positive("Weight must be positive"),
});

export async function createJob(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole(["FACTORY_SUPERVISOR", "OPERATIONS_MANAGER"]);
  const parsed = jobSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const staffIds = formData.getAll("staffIds").map(String).filter(Boolean);

  const res = await createProductionJob({ ...parsed.data, staffIds, actorId: session.userId });
  if (!res.ok) return { error: res.error };

  await audit({ actorId: session.userId, action: "job.create", entity: "Job", entityId: res.jobId, after: { weightInKg: parsed.data.weightInKg } });
  revalidatePath("/production");
  revalidatePath("/inventory");
  return {};
}

export async function completeJob(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole(["FACTORY_SUPERVISOR", "OPERATIONS_MANAGER"]);
  const jobId = String(formData.get("jobId") ?? "");
  const wasteKg = Number(formData.get("wasteKg") ?? 0);
  const outputIds = formData.getAll("outputMaterialTypeId").map(String);
  const outWeights = formData.getAll("outWeight").map(Number);
  const outputs = outputIds.map((id, i) => ({ outputMaterialTypeId: id, weightKg: outWeights[i] }));

  const res = await completeProductionJob({ jobId, outputs, wasteKg, actorId: session.userId });
  if (!res.ok) return { error: res.error };

  await audit({ actorId: session.userId, action: res.status === "FLAGGED" ? "job.flag" : "job.complete", entity: "Job", entityId: jobId, after: { wasteKg, status: res.status } });
  revalidatePath("/production");
  revalidatePath("/inventory");
  return {};
}

export async function resolveJob(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole(["FACTORY_SUPERVISOR", "OPERATIONS_MANAGER"]);
  const jobId = String(formData.get("jobId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const resolution = String(formData.get("resolution") ?? "OVERLOOK") as "OVERLOOK" | "CHARGE_SUPERVISOR" | "CHARGE_STAFF";
  if (!reason) return { error: "A resolution note is required for flagged jobs." };

  const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId }, include: { assignments: true } });
  if (job.status !== "FLAGGED") return { error: "This job is not flagged." };

  const discrepancy = Number(job.weightInKg) - Number(job.weightOutKg ?? 0) - Number(job.wasteKg ?? 0);

  if (resolution !== "OVERLOOK" && discrepancy > 0) {
    const rate = await prisma.vendorRate.findFirst({ where: { materialTypeId: job.materialTypeId }, orderBy: { effectiveFrom: "desc" } });
    const chargeTotal = discrepancy * (rate ? Number(rate.pricePerKg) : 0);
    if (chargeTotal > 0) {
      if (resolution === "CHARGE_SUPERVISOR") {
        const supervisor = await prisma.staffProfile.findUnique({ where: { userId: session.userId } });
        if (supervisor) await prisma.discrepancyCharge.create({ data: { jobId, staffId: supervisor.id, amount: chargeTotal, reason } });
      } else {
        for (const a of job.assignments) {
          await prisma.discrepancyCharge.create({ data: { jobId, staffId: a.staffId, amount: Math.round(chargeTotal * Number(a.share) * 100) / 100, reason } });
        }
      }
    }
  }

  await moveJobOutput(jobId, Number(job.wasteKg ?? 0), discrepancy, session.userId, "RESOLVED", `${reason}${resolution !== "OVERLOOK" ? ` [${resolution === "CHARGE_SUPERVISOR" ? "charged supervisor" : "charged staff"}]` : ""}`);
  await audit({ actorId: session.userId, action: "job.resolve", entity: "Job", entityId: jobId, after: { reason, resolution } });
  revalidatePath("/production");
  revalidatePath("/inventory");
  revalidatePath("/payroll");
  return {};
}
