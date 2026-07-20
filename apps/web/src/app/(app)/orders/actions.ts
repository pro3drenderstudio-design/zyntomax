"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@zyntomax/db";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { sellableStock, homeLocationKind } from "@/lib/inventory";

export type FormState = { error?: string };

async function nextNumber(prefix: string, count: number): Promise<string> {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}-${ymd}-${String(count + 1).padStart(3, "0")}`;
}

/**
 * Record a sale in one step (no separate dispatch):
 *  - inventory lines deduct finished goods (product → customer location)
 *  - non-inventory lines are pure revenue (e.g. scrap sold, service)
 *  - each line has a custom unit price
 *  - an invoice is generated immediately
 */
export async function recordSale(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["SALES_ADMIN", "OPERATIONS_MANAGER"]);
  const customerId = String(formData.get("customerId") ?? "");
  const siteId = String(formData.get("siteId") ?? "");
  const markPaid = formData.get("markPaid") === "on";
  if (!customerId || !siteId) return { error: "Pick a customer and site." };

  const kinds = formData.getAll("kind").map(String); // "inventory" | "other"
  const itemRefs = formData.getAll("itemRef").map(String); // FINISHED material id
  const descriptions = formData.getAll("description").map(String);
  const qtys = formData.getAll("qtyKg").map(Number);
  const prices = formData.getAll("unitPrice").map(Number);

  type Line = {
    isInventory: boolean;
    materialTypeId: string | null;
    description: string | null;
    qtyKg: number;
    unitPrice: number;
  };
  const lines: Line[] = [];
  for (let i = 0; i < kinds.length; i++) {
    const isInv = kinds[i] === "inventory";
    const qty = qtys[i];
    const price = prices[i];
    if (isInv) {
      const id = itemRefs[i] ?? "";
      if (!id || !(qty > 0) || !(price >= 0)) continue;
      lines.push({ isInventory: true, materialTypeId: id, description: null, qtyKg: qty, unitPrice: price });
    } else {
      const desc = (descriptions[i] ?? "").trim();
      if (!desc || !(price > 0)) continue;
      lines.push({ isInventory: false, materialTypeId: null, description: desc, qtyKg: qty > 0 ? qty : 1, unitPrice: price });
    }
  }
  if (lines.length === 0) return { error: "Add at least one valid sale line." };

  // Stock check against live availability of FINISHED materials
  const stock = await sellableStock([siteId]);
  const availOf = new Map(stock.map((s) => [s.materialId, s]));
  for (const l of lines) {
    if (!l.isInventory || !l.materialTypeId) continue;
    const item = availOf.get(l.materialTypeId);
    if (!item || item.availableKg < l.qtyKg) {
      return { error: `Only ${(item?.availableKg ?? 0).toFixed(1)} kg of ${item?.name ?? "that item"} is available.` };
    }
  }

  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
  const total = lines.reduce((s, l) => s + l.qtyKg * l.unitPrice, 0);
  // Sold stock leaves each material's home bucket (finished store, or the
  // in-processing/intake pool for a flagged-sellable intermediate/raw material).
  const homeLocs = await prisma.inventoryLocation.findMany({
    where: { siteId, kind: { in: ["FINISHED_STORE", "IN_PROCESSING", "INTAKE"] } },
  });
  const locByKind = new Map(homeLocs.map((l) => [l.kind, l]));
  const customerLoc = await prisma.inventoryLocation.findFirst({ where: { siteId, kind: "CUSTOMER" } });

  const order = await prisma.$transaction(async (tx) => {
    const so = await tx.salesOrder.create({
      data: {
        siteId,
        customerId,
        orderNo: await nextNumber("SALE", await tx.salesOrder.count()),
        status: "CLOSED",
        createdById: session.userId,
        items: {
          create: lines.map((l) => ({
            materialTypeId: l.materialTypeId,
            description: l.description,
            isInventory: l.isInventory,
            qtyKg: l.qtyKg,
            unitPrice: l.unitPrice,
          })),
        },
      },
    });

    // Deduct sold stock from each material's home bucket
    for (const l of lines) {
      const src = l.materialTypeId
        ? locByKind.get(homeLocationKind(availOf.get(l.materialTypeId)?.kind ?? "FINISHED"))
        : undefined;
      if (l.isInventory && l.materialTypeId && src && customerLoc) {
        await tx.inventoryMovement.create({
          data: {
            fromLocationId: src.id,
            toLocationId: customerLoc.id,
            materialTypeId: l.materialTypeId,
            weightKg: l.qtyKg,
            refType: "SALE",
            refId: so.id,
            byId: session.userId,
            note: "Sold to customer",
          },
        });
      }
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + customer.creditTermsDays);
    const invoice = await tx.invoice.create({
      data: {
        salesOrderId: so.id,
        invoiceNo: await nextNumber("INV", await tx.invoice.count()),
        amount: Math.round(total * 100) / 100,
        dueDate,
        status: markPaid ? "PAID" : "UNPAID",
      },
    });
    if (markPaid) {
      await tx.customerPayment.create({
        data: { invoiceId: invoice.id, amount: Math.round(total * 100) / 100, method: "CASH", receivedById: session.userId },
      });
    }
    return so;
  });

  await audit({
    actorId: session.userId,
    action: "sale.record",
    entity: "SalesOrder",
    entityId: order.id,
    after: { total, lines: lines.length },
  });

  revalidatePath("/orders");
  revalidatePath("/invoices");
  revalidatePath("/inventory");
  redirect(`/orders/${order.id}`);
}

export async function recordCustomerPayment(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["FINANCE_ADMIN", "SALES_ADMIN"]);
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const amount = Number(formData.get("amount"));
  const method = String(formData.get("method") ?? "TRANSFER") as "TRANSFER" | "CASH" | "PAYSTACK";
  const reference = String(formData.get("reference") ?? "").trim() || undefined;
  if (!invoiceId || !amount || amount <= 0) return { error: "Enter a valid amount." };

  const invoice = await prisma.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { payments: true },
  });
  const paid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0) + amount;

  await prisma.$transaction([
    prisma.customerPayment.create({
      data: { invoiceId, amount, method, reference, receivedById: session.userId },
    }),
    prisma.invoice.update({
      where: { id: invoiceId },
      data: { status: paid >= Number(invoice.amount) ? "PAID" : "PARTIAL" },
    }),
  ]);

  await audit({
    actorId: session.userId,
    action: "invoice.payment",
    entity: "Invoice",
    entityId: invoiceId,
    after: { amount, method },
  });

  revalidatePath("/invoices");
  return {};
}
