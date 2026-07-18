"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@zyntomax/db";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { setSetting } from "@/lib/settings";

export type FormState = { error?: string; ok?: string };

export async function saveSettings(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["OPERATIONS_MANAGER"]);

  const numericKeys = [
    "collection.min_pickup_kg",
    "collection.tolerance_pct",
    "production.tolerance_pct",
    "payout.sla_hours",
    "payroll.advance_cap_pct",
  ];
  for (const key of numericKeys) {
    const raw = formData.get(key);
    if (raw === null || raw === "") continue;
    const value = Number(raw);
    if (Number.isNaN(value) || value < 0) return { error: `Invalid value for ${key}.` };
    await setSetting(key, value);
  }

  await audit({
    actorId: session.userId,
    action: "settings.update",
    entity: "Setting",
    entityId: "global",
  });
  revalidatePath("/settings");
  return { ok: "Settings saved." };
}

export async function setVendorRate(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["OPERATIONS_MANAGER", "FINANCE_ADMIN"]);
  const materialTypeId = String(formData.get("materialTypeId") ?? "");
  const price = Number(formData.get("pricePerKg"));
  if (!materialTypeId || !price || price <= 0) return { error: "Enter a valid price." };

  await prisma.vendorRate.create({ data: { materialTypeId, pricePerKg: price } });
  await audit({
    actorId: session.userId,
    action: "vendor_rate.set",
    entity: "MaterialType",
    entityId: materialTypeId,
    after: { pricePerKg: price },
  });
  revalidatePath("/settings");
  return {};
}

export async function setPieceRate(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["OPERATIONS_MANAGER", "FINANCE_ADMIN"]);
  const stageId = String(formData.get("stageId") ?? "");
  const materialTypeId = String(formData.get("materialTypeId") ?? "");
  const rate = Number(formData.get("ratePerKg"));
  if (!stageId || !materialTypeId || !rate || rate <= 0) {
    return { error: "Pick a stage, material, and valid rate." };
  }

  await prisma.rateCard.create({ data: { stageId, materialTypeId, ratePerKg: rate } });
  await audit({
    actorId: session.userId,
    action: "rate_card.set",
    entity: "RateCard",
    entityId: `${stageId}:${materialTypeId}`,
    after: { ratePerKg: rate },
  });
  revalidatePath("/settings");
  return {};
}

export async function createSite(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole([]); // SUPER_ADMIN only (empty list = global roles only)
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "FACTORY") as "FACTORY" | "COLLECTION_HUB";
  if (name.length < 2) return { error: "Enter a site name." };

  const site = await prisma.site.create({ data: { name, kind } });
  // Standard inventory locations for the new site
  const { ensureSiteLocations } = await import("@/lib/inventory");
  await ensureSiteLocations(site.id);

  await audit({
    actorId: session.userId,
    action: "site.create",
    entity: "Site",
    entityId: site.id,
    after: { name },
  });
  revalidatePath("/settings");
  return {};
}

export async function createLocality(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole(["OPERATIONS_MANAGER"]);
  const siteId = String(formData.get("siteId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!siteId || name.length < 2) return { error: "Pick a site and enter a name." };

  const existing = await prisma.locality.findUnique({
    where: { siteId_name: { siteId, name } },
  });
  if (existing) return { error: "That locality already exists." };

  await prisma.locality.create({ data: { siteId, name } });
  revalidatePath("/settings");
  return {};
}

export async function createRewardTier(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole(["OPERATIONS_MANAGER"]);
  const name = String(formData.get("name") ?? "").trim();
  const thresholdKg = Number(formData.get("thresholdKg"));
  const reward = String(formData.get("reward") ?? "").trim();
  if (!name || !reward || !thresholdKg || thresholdKg <= 0) {
    return { error: "Fill in the tier name, threshold and reward." };
  }
  await prisma.rewardTier.create({ data: { name, thresholdKg, reward } });
  revalidatePath("/settings");
  return {};
}

// ── Supplier types (dynamic) ────────────────────────────────────────────
export async function createSupplierType(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole(["OPERATIONS_MANAGER", "PURCHASING_MANAGER"]);
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Enter a type name." };
  const existing = await prisma.supplierType.findUnique({ where: { name } });
  if (existing) return { error: "That supplier type already exists." };
  await prisma.supplierType.create({ data: { name } });
  revalidatePath("/settings");
  revalidatePath("/suppliers");
  return {};
}

export async function deleteSupplierType(id: string) {
  await requireRole(["OPERATIONS_MANAGER", "PURCHASING_MANAGER"]);
  const inUse = await prisma.supplier.count({ where: { typeId: id } });
  if (inUse > 0) {
    // Detach suppliers rather than block deletion.
    await prisma.supplier.updateMany({ where: { typeId: id }, data: { typeId: null } });
  }
  await prisma.supplierType.delete({ where: { id } });
  revalidatePath("/settings");
  revalidatePath("/suppliers");
}

// ── Expense categories (add / remove) ──────────────────────────────────
export async function createExpenseCategory(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole(["OPERATIONS_MANAGER", "FINANCE_ADMIN"]);
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Enter a category name." };
  const existing = await prisma.expenseCategory.findUnique({ where: { name } });
  if (existing) return { error: "That category already exists." };
  await prisma.expenseCategory.create({ data: { name } });
  revalidatePath("/settings");
  revalidatePath("/expenses");
  return {};
}

export async function deleteExpenseCategory(id: string): Promise<void> {
  await requireRole(["OPERATIONS_MANAGER", "FINANCE_ADMIN"]);
  const inUse = await prisma.expense.count({ where: { categoryId: id } });
  if (inUse > 0) return; // keep categories that have expenses (preserve history)
  await prisma.budget.deleteMany({ where: { categoryId: id } });
  await prisma.expenseCategory.delete({ where: { id } });
  revalidatePath("/settings");
  revalidatePath("/expenses");
}

// ── Wage model per staff (Super Admin) ─────────────────────────────────
export async function setStaffWage(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole([]); // SUPER_ADMIN only
  const staffId = String(formData.get("staffId") ?? "");
  const wageModel = String(formData.get("wageModel") ?? "COMMISSION") as
    | "COMMISSION" | "SALARY" | "COMMISSION_PLUS_BASE";
  const baseRaw = formData.get("baseSalaryWeekly");
  const baseSalaryWeekly = baseRaw ? Number(baseRaw) : null;

  if (wageModel !== "COMMISSION" && (!baseSalaryWeekly || baseSalaryWeekly <= 0)) {
    return { error: "Enter the weekly base salary for salaried staff." };
  }

  await prisma.staffProfile.update({
    where: { id: staffId },
    data: {
      wageModel,
      baseSalaryWeekly: wageModel === "COMMISSION" ? null : baseSalaryWeekly,
    },
  });
  await audit({
    actorId: session.userId,
    action: "staff.wage_model",
    entity: "StaffProfile",
    entityId: staffId,
    after: { wageModel, baseSalaryWeekly },
  });
  revalidatePath(`/staff/${staffId}`);
  return {};
}
