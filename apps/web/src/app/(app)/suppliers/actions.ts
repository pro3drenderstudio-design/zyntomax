"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@zyntomax/db";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";

export type FormState = { error?: string; ok?: string };

const supplierSchema = z.object({
  name: z.string().min(2),
  typeId: z.string().optional(),
  phone: z.string().optional(),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNo: z.string().optional(),
  bankAccountName: z.string().optional(),
  notes: z.string().optional(),
});

export async function createSupplier(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["PURCHASING_MANAGER", "OPERATIONS_MANAGER"]);
  const parsed = supplierSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const supplier = await prisma.supplier.create({
    data: { ...d, typeId: d.typeId || null },
  });
  await audit({
    actorId: session.userId,
    action: "supplier.create",
    entity: "Supplier",
    entityId: supplier.id,
    after: { name: supplier.name },
  });
  revalidatePath("/suppliers");
  return { ok: `Added ${supplier.name}.` };
}

export async function updateSupplier(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["PURCHASING_MANAGER", "OPERATIONS_MANAGER"]);
  const id = String(formData.get("id") ?? "");
  const parsed = supplierSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  await prisma.supplier.update({
    where: { id },
    data: {
      name: d.name,
      typeId: d.typeId || null,
      phone: d.phone ?? null,
      contactPerson: d.contactPerson ?? null,
      contactPhone: d.contactPhone ?? null,
      address: d.address ?? null,
      bankName: d.bankName ?? null,
      bankAccountNo: d.bankAccountNo ?? null,
      bankAccountName: d.bankAccountName ?? null,
      notes: d.notes ?? null,
    },
  });
  await audit({
    actorId: session.userId,
    action: "supplier.update",
    entity: "Supplier",
    entityId: id,
    after: { name: d.name },
  });
  revalidatePath("/suppliers");
  revalidatePath(`/suppliers/${id}`);
  return { ok: "Saved." };
}

/** Prepayment: money advanced to a supplier before delivery (drawn down by batches). */
export async function addPrepayment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["FINANCE_ADMIN", "PURCHASING_MANAGER"]);
  const supplierId = String(formData.get("supplierId") ?? "");
  const amount = Number(formData.get("amount"));
  const method = String(formData.get("method") ?? "TRANSFER") as "TRANSFER" | "CASH" | "PAYSTACK";
  const reference = String(formData.get("reference") ?? "").trim() || undefined;
  const note = String(formData.get("note") ?? "").trim() || undefined;
  if (!supplierId || !amount || amount <= 0) return { error: "Enter a valid amount." };

  await prisma.supplierPrepayment.create({
    data: { supplierId, amount, method, reference, note, paidById: session.userId },
  });
  await audit({
    actorId: session.userId,
    action: "supplier.prepay",
    entity: "Supplier",
    entityId: supplierId,
    after: { amount },
  });
  revalidatePath(`/suppliers/${supplierId}`);
  revalidatePath("/suppliers");
  return { ok: "Prepayment recorded." };
}
