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

/**
 * Record a payment to a supplier — the single supplier account. Works from
 * both the supplier page (advance, no batch) and the purchase page (payment
 * in relation to a batch). Every payment is a credit to the account; batches
 * settle against it FIFO, so advances automatically cover future deliveries.
 */
export async function recordSupplierPayment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["FINANCE_ADMIN", "PURCHASING_MANAGER"]);
  const supplierId = String(formData.get("supplierId") ?? "");
  const batchId = String(formData.get("batchId") ?? "").trim() || undefined;
  const amount = Number(formData.get("amount"));
  const method = String(formData.get("method") ?? "TRANSFER") as "TRANSFER" | "CASH" | "PAYSTACK";
  const reference = String(formData.get("reference") ?? "").trim() || undefined;
  const note = String(formData.get("note") ?? "").trim() || undefined;
  if (!supplierId || !amount || amount <= 0) return { error: "Enter a valid amount." };

  await prisma.supplierPayment.create({
    data: { supplierId, batchId, amount, method, reference, note, paidById: session.userId },
  });
  await audit({
    actorId: session.userId,
    action: "supplier.payment",
    entity: "Supplier",
    entityId: supplierId,
    after: { amount, batchId },
  });
  revalidatePath(`/suppliers/${supplierId}`);
  revalidatePath("/suppliers");
  if (batchId) revalidatePath(`/purchases/${batchId}`);
  revalidatePath("/purchases");
  return { ok: "Payment recorded." };
}
