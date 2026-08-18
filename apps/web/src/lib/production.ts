import { prisma } from "@zyntomax/db";
import { getSetting } from "@/lib/settings";
import { siteLocation, stageLocation, materialAvailable } from "@/lib/inventory";

export type ProdResult<T> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * Create a production job: consume `weightIn` of the input material from where it
 * lives (raw → intake; intermediate → the in-processing pool) into the stage's
 * active-work bucket. Shared by the web action and the mobile scale-station.
 */
export async function createProductionJob(input: {
  siteId: string; stageId: string; materialTypeId: string; weightInKg: number;
  staffIds: string[]; scaleInPhotoUrl?: string; actorId: string;
}): Promise<ProdResult<{ jobId: string }>> {
  const { siteId, stageId, materialTypeId, weightInKg, staffIds, scaleInPhotoUrl, actorId } = input;
  if (!(weightInKg > 0)) return { ok: false, error: "Weight must be positive." };
  if (staffIds.length === 0) return { ok: false, error: "Assign at least one staff member." };

  const recipe = await prisma.stageOutput.findFirst({ where: { stageId, inputMaterialTypeId: materialTypeId, active: true } });
  if (!recipe) return { ok: false, error: "This stage has no recipe for that material." };

  const material = await prisma.materialType.findUnique({ where: { id: materialTypeId } });
  if (!material) return { ok: false, error: "Material not found." };
  if (material.kind === "FINISHED") return { ok: false, error: "Finished goods can't be processed further." };

  const available = await materialAvailable(siteId, materialTypeId);
  if (available < weightInKg) return { ok: false, error: `Only ${available.toFixed(1)} kg of ${material.name} is available.` };

  const source = await siteLocation(siteId, material.kind === "RAW" ? "INTAKE" : "IN_PROCESSING");
  const wip = await stageLocation(siteId, stageId);
  const tolerance = await getSetting<number>("production.tolerance_pct", 2, siteId);

  let jobId = "";
  await prisma.$transaction(async (tx) => {
    const job = await tx.job.create({
      data: {
        siteId, stageId, materialTypeId, weightInKg, toleranceSnapshot: tolerance, scaleInPhotoUrl,
        status: "IN_PROGRESS",
        assignments: { create: staffIds.map((staffId) => ({ staffId, share: 1 / staffIds.length })) },
      },
    });
    jobId = job.id;
    await tx.inventoryMovement.create({
      data: { fromLocationId: source.id, toLocationId: wip.id, materialTypeId, weightKg: weightInKg, refType: "JOB", refId: job.id, byId: actorId, note: "Assigned to job" },
    });
  });
  return { ok: true, jobId };
}

/**
 * Complete (scale-out) a job: record the recipe outputs + waste, check the
 * mass-balance discrepancy against tolerance. Within tolerance → transform the
 * input into the outputs (inventory). Beyond → FLAGGED for supervisor review.
 */
export async function completeProductionJob(input: {
  jobId: string; outputs: { outputMaterialTypeId: string; weightKg: number }[]; wasteKg: number;
  scaleOutPhotoUrl?: string; actorId: string;
}): Promise<ProdResult<{ status: string }>> {
  const { jobId, outputs, wasteKg, scaleOutPhotoUrl, actorId } = input;
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return { ok: false, error: "Job not found." };
  if (!["ASSIGNED", "IN_PROGRESS"].includes(job.status)) return { ok: false, error: "This job is not open." };

  const outputLines = outputs.filter((l) => l.outputMaterialTypeId && l.weightKg > 0);
  if (outputLines.length === 0) return { ok: false, error: "Enter the weight of at least one output material." };

  const validOutputs = new Set(
    (await prisma.stageOutput.findMany({ where: { stageId: job.stageId, inputMaterialTypeId: job.materialTypeId, active: true }, select: { outputMaterialTypeId: true } })).map((r) => r.outputMaterialTypeId),
  );
  if (outputLines.some((l) => !validOutputs.has(l.outputMaterialTypeId))) return { ok: false, error: "An output material is not valid for this stage." };

  const weightOutKg = outputLines.reduce((s, l) => s + l.weightKg, 0);
  if (Number.isNaN(wasteKg) || wasteKg < 0) return { ok: false, error: "Enter a valid waste weight." };
  const weightIn = Number(job.weightInKg);
  if (weightOutKg + wasteKg > weightIn * 1.5) return { ok: false, error: "Output + waste is implausibly higher than the scaled-in weight." };
  const discrepancy = weightIn - weightOutKg - wasteKg;
  const discrepancyPct = weightIn > 0 ? (discrepancy / weightIn) * 100 : 0;
  const beyondTolerance = Math.abs(discrepancyPct) > Number(job.toleranceSnapshot);

  await prisma.jobOutput.deleteMany({ where: { jobId } });
  await prisma.jobOutput.createMany({ data: outputLines.map((l) => ({ jobId, outputMaterialTypeId: l.outputMaterialTypeId, weightKg: l.weightKg })) });

  if (beyondTolerance) {
    await prisma.job.update({
      where: { id: jobId },
      data: { weightOutKg, wasteKg, scaleOutPhotoUrl, status: "FLAGGED", flagReason: `Discrepancy ${discrepancyPct.toFixed(1)}% exceeds ±${Number(job.toleranceSnapshot)}% tolerance`, completedAt: new Date() },
    });
    return { ok: true, status: "FLAGGED" };
  }
  if (scaleOutPhotoUrl) await prisma.job.update({ where: { id: jobId }, data: { scaleOutPhotoUrl } });
  await moveJobOutput(jobId, wasteKg, discrepancy, actorId, "COMPLETED");
  return { ok: true, status: "COMPLETED" };
}

/**
 * Move a job's materials on completion/resolution: consume input from the stage's
 * active bucket, transform into each output (intermediate → in-processing pool;
 * finished → finished store), waste + unaccounted loss → waste. Mass-balanced.
 */
export async function moveJobOutput(
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

  const outputs = await prisma.jobOutput.findMany({ where: { jobId }, include: { outputMaterial: true } });
  const weightOutKg = outputs.reduce((s, o) => s + Number(o.weightKg), 0);

  await prisma.$transaction(async (tx) => {
    if (discrepancy < 0) {
      await tx.inventoryMovement.create({ data: { toLocationId: wip.id, materialTypeId: job.materialTypeId, weightKg: -discrepancy, refType: "ADJUSTMENT", refId: jobId, byId: actorId, note: "Scale gain adjustment" } });
    }
    for (const o of outputs) {
      const w = Number(o.weightKg);
      if (w <= 0) continue;
      await tx.inventoryMovement.create({ data: { fromLocationId: wip.id, materialTypeId: job.materialTypeId, weightKg: w, refType: "JOB", refId: jobId, byId: actorId, note: `Transformed into ${o.outputMaterial.name}` } });
      await tx.inventoryMovement.create({ data: { toLocationId: o.outputMaterial.kind === "FINISHED" ? finished.id : inProcessing.id, materialTypeId: o.outputMaterialTypeId, weightKg: w, lotNo: job.lotNo, refType: "JOB", refId: jobId, byId: actorId, note: `Produced ${o.outputMaterial.name}` } });
    }
    if (wasteKg > 0) {
      await tx.inventoryMovement.create({ data: { fromLocationId: wip.id, toLocationId: waste.id, materialTypeId: job.materialTypeId, weightKg: wasteKg, refType: "JOB", refId: jobId, byId: actorId, note: "Process waste" } });
    }
    if (discrepancy > 0) {
      await tx.inventoryMovement.create({ data: { fromLocationId: wip.id, toLocationId: waste.id, materialTypeId: job.materialTypeId, weightKg: discrepancy, refType: "JOB", refId: jobId, byId: actorId, note: resolutionNote ? `Unaccounted loss — ${resolutionNote}` : "Within-tolerance loss" } });
    }
    await tx.job.update({ where: { id: jobId }, data: { weightOutKg, wasteKg, status: finalStatus, completedAt: new Date(), ...(resolutionNote ? { resolvedById: actorId, flagReason: resolutionNote } : {}) } });
  });
}
