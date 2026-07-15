"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@zyntomax/db";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { siteLocation } from "@/lib/inventory";

export type FormState = { error?: string };

async function nextLotNo(): Promise<string> {
  const today = new Date();
  const ymd = today.toISOString().slice(0, 10).replace(/-/g, "");
  const count = await prisma.purchaseBatch.count({
    where: { lotNo: { startsWith: `LOT-${ymd}` } },
  });
  return `LOT-${ymd}-${String(count + 1).padStart(3, "0")}`;
}

const batchSchema = z.object({
  siteId: z.string().min(1),
  supplierId: z.string().min(1),
  fieldEstKg: z.coerce.number().positive().optional(),
});

export async function createPurchaseBatch(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["PURCHASING_MANAGER", "FACTORY_SUPERVISOR", "OPERATIONS_MANAGER"]);
  const raw = Object.fromEntries(formData.entries());
  const parsed = batchSchema.safeParse({
    ...raw,
    fieldEstKg: raw.fieldEstKg || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const batch = await prisma.purchaseBatch.create({
    data: {
      siteId: parsed.data.siteId,
      supplierId: parsed.data.supplierId,
      fieldEstKg: parsed.data.fieldEstKg,
      lotNo: await nextLotNo(),
      purchasedById: session.userId,
    },
  });

  await audit({
    actorId: session.userId,
    action: "purchase.create",
    entity: "PurchaseBatch",
    entityId: batch.id,
    after: { lotNo: batch.lotNo },
  });

  revalidatePath("/purchases");
  redirect(`/purchases/${batch.id}`);
}

/** Factory supervisor scales the truck in: one line per material type. */
export async function scaleInBatch(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["FACTORY_SUPERVISOR", "OPERATIONS_MANAGER"]);
  const batchId = String(formData.get("batchId") ?? "");

  const batch = await prisma.purchaseBatch.findUniqueOrThrow({
    where: { id: batchId },
    include: { items: true },
  });
  if (batch.scaledInAt) return { error: "This batch has already been scaled in." };

  const materialIds = formData.getAll("materialTypeId").map(String);
  const weights = formData.getAll("weightKg").map(Number);
  const prices = formData.getAll("pricePerKg").map(Number);

  const lines = materialIds
    .map((m, i) => ({ materialTypeId: m, weightKg: weights[i], pricePerKg: prices[i] }))
    .filter((l) => l.materialTypeId && l.weightKg > 0);

  if (lines.length === 0) return { error: "Add at least one material line with a weight." };
  if (lines.some((l) => Number.isNaN(l.weightKg) || Number.isNaN(l.pricePerKg) || l.pricePerKg < 0)) {
    return { error: "Every line needs a valid weight and price." };
  }

  const intake = await siteLocation(batch.siteId, "INTAKE");

  await prisma.$transaction(async (tx) => {
    for (const line of lines) {
      await tx.purchaseBatchItem.create({
        data: {
          batchId,
          materialTypeId: line.materialTypeId,
          weightKg: line.weightKg,
          pricePerKg: line.pricePerKg,
          amount: line.weightKg * line.pricePerKg,
        },
      });
      // External source → factory intake (fromLocation null = outside world)
      await tx.inventoryMovement.create({
        data: {
          toLocationId: intake.id,
          materialTypeId: line.materialTypeId,
          weightKg: line.weightKg,
          lotNo: batch.lotNo,
          refType: "PURCHASE_BATCH",
          refId: batchId,
          byId: session.userId,
          note: "Purchase scale-in",
        },
      });
    }
    await tx.purchaseBatch.update({
      where: { id: batchId },
      data: { scaledInAt: new Date(), scaledInById: session.userId },
    });
  });

  await audit({
    actorId: session.userId,
    action: "purchase.scale_in",
    entity: "PurchaseBatch",
    entityId: batchId,
    after: { lines },
  });

  revalidatePath(`/purchases/${batchId}`);
  revalidatePath("/purchases");
  revalidatePath("/inventory");
  return {};
}

const paymentSchema = z.object({
  batchId: z.string().min(1),
  amount: z.coerce.number().positive(),
  method: z.enum(["TRANSFER", "CASH", "PAYSTACK"]),
  reference: z.string().optional(),
  isAdvance: z.coerce.boolean().optional(),
});

export async function addSupplierPayment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["FINANCE_ADMIN", "PURCHASING_MANAGER"]);
  const parsed = paymentSchema.safeParse({
    ...Object.fromEntries(formData.entries()),
    isAdvance: formData.get("isAdvance") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { batchId, amount, method, reference, isAdvance } = parsed.data;

  const batch = await prisma.purchaseBatch.findUniqueOrThrow({
    where: { id: batchId },
    include: { items: true, supplierPayments: true },
  });

  const itemsTotal = batch.items.reduce((s, i) => s + Number(i.amount), 0);
  const paidSoFar = batch.supplierPayments.reduce((s, p) => s + Number(p.amount), 0);
  const newTotal = paidSoFar + amount;

  await prisma.$transaction([
    prisma.supplierPayment.create({
      data: { batchId, amount, method, reference, isAdvance: isAdvance ?? false, paidById: session.userId },
    }),
    prisma.purchaseBatch.update({
      where: { id: batchId },
      data: {
        paymentStatus:
          itemsTotal > 0 && newTotal >= itemsTotal ? "PAID" : "PARTIAL",
      },
    }),
  ]);

  await audit({
    actorId: session.userId,
    action: "purchase.payment",
    entity: "PurchaseBatch",
    entityId: batchId,
    after: { amount, method },
  });

  revalidatePath(`/purchases/${batchId}`);
  return {};
}
