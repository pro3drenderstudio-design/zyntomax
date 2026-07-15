"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, Prisma } from "@zyntomax/db";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";

export type FormState = { error?: string };

async function productBalance(siteId: string, productId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ balance: number }[]>(Prisma.sql`
    SELECT COALESCE(SUM(
      CASE WHEN l.kind = 'FINISHED_STORE' AND mv."toLocationId" = l.id THEN mv."weightKg"
           WHEN l.kind = 'FINISHED_STORE' AND mv."fromLocationId" = l.id THEN -mv."weightKg"
           ELSE 0 END
    ), 0) AS balance
    FROM "InventoryMovement" mv
    JOIN "InventoryLocation" l
      ON l.id = mv."toLocationId" OR l.id = mv."fromLocationId"
    WHERE mv."productId" = ${productId} AND l."siteId" = ${siteId}
  `);
  return Number(rows[0]?.balance ?? 0);
}

async function nextNumber(prefix: string, count: number): Promise<string> {
  const ymd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `${prefix}-${ymd}-${String(count + 1).padStart(3, "0")}`;
}

export async function createOrder(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["SALES_ADMIN", "OPERATIONS_MANAGER"]);
  const customerId = String(formData.get("customerId") ?? "");
  const siteId = String(formData.get("siteId") ?? "");
  if (!customerId || !siteId) return { error: "Pick a customer and site." };

  const productIds = formData.getAll("productId").map(String);
  const qtys = formData.getAll("qtyKg").map(Number);
  const lines = productIds
    .map((p, i) => ({ productId: p, qtyKg: qtys[i] }))
    .filter((l) => l.productId && l.qtyKg > 0);
  if (lines.length === 0) return { error: "Add at least one product line." };

  // Price snapshot: customer override wins over list price
  const items: { productId: string; qtyKg: number; unitPrice: number }[] = [];
  for (const line of lines) {
    const price = await prisma.priceList.findFirst({
      where: {
        productId: line.productId,
        effectiveFrom: { lte: new Date() },
        OR: [{ customerId }, { customerId: null }],
      },
      orderBy: [{ customerId: { sort: "desc", nulls: "last" } }, { effectiveFrom: "desc" }],
    });
    if (!price) return { error: "A product on this order has no price set." };
    items.push({ ...line, unitPrice: Number(price.pricePerKg) });
  }

  const order = await prisma.salesOrder.create({
    data: {
      siteId,
      customerId,
      orderNo: await nextNumber("SO", await prisma.salesOrder.count()),
      status: "CONFIRMED",
      createdById: session.userId,
      items: { create: items },
    },
  });

  await audit({
    actorId: session.userId,
    action: "order.create",
    entity: "SalesOrder",
    entityId: order.id,
    after: { orderNo: order.orderNo, items },
  });

  revalidatePath("/orders");
  redirect(`/orders/${order.id}`);
}

export async function createDispatch(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["SALES_ADMIN", "FACTORY_SUPERVISOR", "OPERATIONS_MANAGER"]);
  const orderId = String(formData.get("orderId") ?? "");
  const vehicle = String(formData.get("vehicle") ?? "").trim() || undefined;
  const driverName = String(formData.get("driverName") ?? "").trim() || undefined;

  const order = await prisma.salesOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: { customer: true, items: true, dispatches: { include: { items: true } } },
  });
  if (!["CONFIRMED", "PARTIALLY_DISPATCHED"].includes(order.status)) {
    return { error: "This order is not open for dispatch." };
  }

  const productIds = formData.getAll("productId").map(String);
  const weights = formData.getAll("weightKg").map(Number);
  const lines = productIds
    .map((p, i) => ({ productId: p, weightKg: weights[i] }))
    .filter((l) => l.productId && l.weightKg > 0);
  if (lines.length === 0) return { error: "Enter the scaled weight for at least one product." };

  // Stock check per product
  for (const line of lines) {
    const available = await productBalance(order.siteId, line.productId);
    if (available < line.weightKg) {
      return { error: `Only ${available.toFixed(1)} kg of a product is in the finished goods store.` };
    }
  }

  const store = await prisma.inventoryLocation.findFirstOrThrow({
    where: { siteId: order.siteId, kind: "FINISHED_STORE" },
  });
  const customerLoc = await prisma.inventoryLocation.findFirstOrThrow({
    where: { siteId: order.siteId, kind: "CUSTOMER" },
  });

  // Invoice amount uses the order's unit prices on the dispatched weight
  const priceOf = new Map(order.items.map((i) => [i.productId, Number(i.unitPrice)]));
  let amount = 0;
  for (const line of lines) {
    const unit = priceOf.get(line.productId);
    if (unit === undefined) return { error: "A dispatched product is not on this order." };
    amount += unit * line.weightKg;
  }

  await prisma.$transaction(async (tx) => {
    const dispatch = await tx.dispatch.create({
      data: {
        orderId,
        waybillNo: await nextNumber("WB", await tx.dispatch.count()),
        vehicle,
        driverName,
        status: "DEPARTED",
        items: { create: lines },
      },
    });

    for (const line of lines) {
      await tx.inventoryMovement.create({
        data: {
          fromLocationId: store.id,
          toLocationId: customerLoc.id,
          productId: line.productId,
          weightKg: line.weightKg,
          refType: "DISPATCH",
          refId: dispatch.id,
          byId: session.userId,
          note: "Dispatched to customer",
        },
      });
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + order.customer.creditTermsDays);
    await tx.invoice.create({
      data: {
        dispatchId: dispatch.id,
        invoiceNo: await nextNumber("INV", await tx.invoice.count()),
        amount: Math.round(amount * 100) / 100,
        dueDate,
      },
    });

    // Order status: compare total dispatched (incl. this one) vs ordered
    const orderedKg = order.items.reduce((s, i) => s + Number(i.qtyKg), 0);
    const previouslyDispatched = order.dispatches
      .flatMap((d) => d.items)
      .reduce((s, i) => s + Number(i.weightKg), 0);
    const nowDispatched = previouslyDispatched + lines.reduce((s, l) => s + l.weightKg, 0);
    await tx.salesOrder.update({
      where: { id: orderId },
      data: {
        status: nowDispatched >= orderedKg * 0.99 ? "DISPATCHED" : "PARTIALLY_DISPATCHED",
      },
    });
  });

  await audit({
    actorId: session.userId,
    action: "dispatch.create",
    entity: "SalesOrder",
    entityId: orderId,
    after: { lines, amount },
  });

  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/dispatches");
  revalidatePath("/invoices");
  revalidatePath("/inventory");
  return {};
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
