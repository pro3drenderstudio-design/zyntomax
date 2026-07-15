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
