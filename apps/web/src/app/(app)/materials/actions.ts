"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@zyntomax/db";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";

export type FormState = { error?: string };

export async function createMaterialType(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["OPERATIONS_MANAGER"]);
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Enter a material name." };

  const existing = await prisma.materialType.findUnique({ where: { name } });
  if (existing) return { error: "That material type already exists." };

  const mat = await prisma.materialType.create({ data: { name } });
  await audit({
    actorId: session.userId,
    action: "material.create",
    entity: "MaterialType",
    entityId: mat.id,
    after: { name },
  });
  revalidatePath("/materials");
  return {};
}

export async function createStage(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["OPERATIONS_MANAGER"]);
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Enter a stage name." };

  const existing = await prisma.processStage.findUnique({ where: { name } });
  if (existing) return { error: "That stage already exists." };

  const stage = await prisma.processStage.create({ data: { name } });
  await audit({
    actorId: session.userId,
    action: "stage.create",
    entity: "ProcessStage",
    entityId: stage.id,
    after: { name },
  });
  revalidatePath("/materials");
  return {};
}

export async function setStagePayBasis(stageId: string, basis: "SCALE_IN" | "SCALE_OUT") {
  const session = await requireRole(["OPERATIONS_MANAGER"]);
  await prisma.processStage.update({ where: { id: stageId }, data: { payBasis: basis } });
  await audit({
    actorId: session.userId,
    action: "stage.pay_basis",
    entity: "ProcessStage",
    entityId: stageId,
    after: { basis },
  });
  revalidatePath("/materials");
}

export async function createStageOutput(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["OPERATIONS_MANAGER"]);
  const stageId = String(formData.get("stageId") ?? "");
  const materialTypeId = String(formData.get("materialTypeId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const color = String(formData.get("color") ?? "").trim() || null;
  if (!stageId || !materialTypeId || name.length < 2) {
    return { error: "Pick a stage, input material and output name." };
  }
  await prisma.stageOutput.create({ data: { stageId, materialTypeId, name, color } });
  await audit({
    actorId: session.userId,
    action: "stage_output.create",
    entity: "StageOutput",
    entityId: `${stageId}:${materialTypeId}`,
    after: { name, color },
  });
  revalidatePath("/materials");
  return {};
}

export async function deleteStageOutput(id: string) {
  await requireRole(["OPERATIONS_MANAGER"]);
  const used = await prisma.jobOutput.count({ where: { stageOutputId: id } });
  if (used > 0) {
    await prisma.stageOutput.update({ where: { id }, data: { active: false } });
  } else {
    await prisma.stageOutput.delete({ where: { id } });
  }
  revalidatePath("/materials");
}

/** Replace a material's route with an ordered list of stage ids. */
export async function setRoute(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["OPERATIONS_MANAGER"]);
  const materialTypeId = String(formData.get("materialTypeId") ?? "");
  const stageIds = formData.getAll("stageIds").map(String).filter(Boolean);

  if (!materialTypeId) return { error: "Missing material." };
  if (stageIds.length === 0) return { error: "Pick at least one stage." };
  if (new Set(stageIds).size !== stageIds.length) {
    return { error: "A stage cannot appear twice in one route." };
  }

  await prisma.$transaction([
    prisma.materialRoute.deleteMany({ where: { materialTypeId } }),
    prisma.materialRoute.createMany({
      data: stageIds.map((stageId, i) => ({
        materialTypeId,
        stageId,
        sequence: i + 1,
      })),
    }),
  ]);

  await audit({
    actorId: session.userId,
    action: "material.route",
    entity: "MaterialType",
    entityId: materialTypeId,
    after: { stageIds },
  });
  revalidatePath("/materials");
  return {};
}
