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
  const kind = String(formData.get("kind") ?? "RAW") as "RAW" | "INTERMEDIATE" | "FINISHED";
  const color = String(formData.get("color") ?? "").trim() || null;
  if (name.length < 2) return { error: "Enter a material name." };
  if (!["RAW", "INTERMEDIATE", "FINISHED"].includes(kind)) return { error: "Pick a material kind." };

  const existing = await prisma.materialType.findUnique({ where: { name } });
  if (existing) return { error: "That material already exists." };

  const mat = await prisma.materialType.create({ data: { name, kind, color } });
  await audit({ actorId: session.userId, action: "material.create", entity: "MaterialType", entityId: mat.id, after: { name, kind } });
  revalidatePath("/materials");
  return {};
}

/** Delete a material type — only if it has no transaction history. */
export async function deleteMaterialType(id: string): Promise<FormState> {
  const session = await requireRole(["OPERATIONS_MANAGER"]);
  const [movements, jobs, jobOutputs, purchases, weighIns, reconItems, saleItems] = await Promise.all([
    prisma.inventoryMovement.count({ where: { materialTypeId: id } }),
    prisma.job.count({ where: { materialTypeId: id } }),
    prisma.jobOutput.count({ where: { outputMaterialTypeId: id } }),
    prisma.purchaseBatchItem.count({ where: { materialTypeId: id } }),
    prisma.collectionWeighIn.count({ where: { materialTypeId: id } }),
    prisma.tripReconciliationItem.count({ where: { materialTypeId: id } }),
    prisma.salesOrderItem.count({ where: { materialTypeId: id } }),
  ]);
  if (movements + jobs + jobOutputs + purchases + weighIns + reconItems + saleItems > 0) {
    return { error: "This material has transaction history — deactivate it instead of deleting." };
  }
  const mat = await prisma.materialType.findUnique({ where: { id } });
  if (!mat) return { error: "Material not found." };
  // Clear config-only references, then delete.
  await prisma.stageOutput.deleteMany({ where: { OR: [{ inputMaterialTypeId: id }, { outputMaterialTypeId: id }] } });
  await prisma.priceList.deleteMany({ where: { materialTypeId: id } });
  await prisma.rateCard.deleteMany({ where: { materialTypeId: id } });
  await prisma.vendorRate.deleteMany({ where: { materialTypeId: id } });
  await prisma.target.deleteMany({ where: { materialTypeId: id } });
  await prisma.materialType.delete({ where: { id } });
  await audit({ actorId: session.userId, action: "material.delete", entity: "MaterialType", entityId: id, before: { name: mat.name } });
  revalidatePath("/materials");
  return {};
}

/** Toggle whether a material can be sold (FINISHED goods are always sellable). */
export async function setSellable(id: string, sellable: boolean) {
  const session = await requireRole(["OPERATIONS_MANAGER"]);
  await prisma.materialType.update({ where: { id }, data: { sellable } });
  await audit({ actorId: session.userId, action: "material.sellable", entity: "MaterialType", entityId: id, after: { sellable } });
  revalidatePath("/materials");
  revalidatePath("/orders");
  revalidatePath("/customers");
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
  await audit({ actorId: session.userId, action: "stage.create", entity: "ProcessStage", entityId: stage.id, after: { name } });
  revalidatePath("/materials");
  return {};
}

export async function setStagePayBasis(stageId: string, basis: "SCALE_IN" | "SCALE_OUT") {
  const session = await requireRole(["OPERATIONS_MANAGER"]);
  await prisma.processStage.update({ where: { id: stageId }, data: { payBasis: basis } });
  await audit({ actorId: session.userId, action: "stage.pay_basis", entity: "ProcessStage", entityId: stageId, after: { basis } });
  revalidatePath("/materials");
}

/** Add a recipe: at `stage`, input material yields output material. */
export async function createRecipe(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["OPERATIONS_MANAGER"]);
  const stageId = String(formData.get("stageId") ?? "");
  const inputMaterialTypeId = String(formData.get("inputMaterialTypeId") ?? "");
  const outputMaterialTypeId = String(formData.get("outputMaterialTypeId") ?? "");
  if (!stageId || !inputMaterialTypeId || !outputMaterialTypeId) {
    return { error: "Pick a stage, input material and output material." };
  }
  if (inputMaterialTypeId === outputMaterialTypeId) {
    return { error: "A stage must transform the input into a different material." };
  }
  const existing = await prisma.stageOutput.findFirst({
    where: { stageId, inputMaterialTypeId, outputMaterialTypeId },
  });
  if (existing) {
    await prisma.stageOutput.update({ where: { id: existing.id }, data: { active: true } });
  } else {
    await prisma.stageOutput.create({ data: { stageId, inputMaterialTypeId, outputMaterialTypeId } });
  }
  await audit({ actorId: session.userId, action: "recipe.create", entity: "StageOutput", entityId: `${stageId}:${inputMaterialTypeId}` });
  revalidatePath("/materials");
  return {};
}

export async function deleteRecipe(id: string) {
  await requireRole(["OPERATIONS_MANAGER"]);
  const used = await prisma.jobOutput.count({
    where: { outputMaterial: { recipesAsOutput: { some: { id } } } },
  });
  // Recipes that have been used are deactivated (history preserved); else deleted.
  if (used > 0) {
    await prisma.stageOutput.update({ where: { id }, data: { active: false } });
  } else {
    await prisma.stageOutput.delete({ where: { id } });
  }
  revalidatePath("/materials");
}
