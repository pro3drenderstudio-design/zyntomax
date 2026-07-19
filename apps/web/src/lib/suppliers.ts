import { prisma } from "@zyntomax/db";

export type BatchSettlement = {
  batchId: string;
  cost: number;
  covered: number; // paid from the supplier account (FIFO)
  outstanding: number;
  status: "UNPAID" | "PARTIAL" | "PAID";
};

export type SupplierAccount = {
  supplierId: string;
  totalPaid: number; // Σ all payments (advances + batch payments)
  totalDelivered: number; // Σ value of scaled-in batches
  /** > 0 = credit held with supplier (prepaid); < 0 = we owe the supplier. */
  balance: number;
  owed: number; // amount we still owe (max(0, delivered − paid))
  credit: number; // unused prepayment (max(0, paid − delivered))
  batches: Record<string, BatchSettlement>;
};

function settle(
  batches: { id: string; cost: number }[],
  totalPaid: number,
): { batches: Record<string, BatchSettlement>; totalDelivered: number } {
  let remaining = totalPaid;
  let totalDelivered = 0;
  const out: Record<string, BatchSettlement> = {};
  // Oldest delivery first
  for (const b of batches) {
    totalDelivered += b.cost;
    const covered = Math.min(remaining, b.cost);
    remaining -= covered;
    const outstanding = Math.round((b.cost - covered) * 100) / 100;
    out[b.id] = {
      batchId: b.id,
      cost: b.cost,
      covered: Math.round(covered * 100) / 100,
      outstanding,
      status: b.cost <= 0.01 ? "UNPAID" : outstanding <= 0.01 ? "PAID" : covered > 0.01 ? "PARTIAL" : "UNPAID",
    };
  }
  return { batches: out, totalDelivered };
}

export async function supplierAccount(supplierId: string): Promise<SupplierAccount> {
  const [payments, batches] = await Promise.all([
    prisma.supplierPayment.aggregate({ _sum: { amount: true }, where: { supplierId } }),
    prisma.purchaseBatch.findMany({
      where: { supplierId },
      include: { items: true },
      orderBy: [{ scaledInAt: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  const totalPaid = Number(payments._sum.amount ?? 0);
  const costed = batches.map((b) => ({ id: b.id, cost: b.items.reduce((s, i) => s + Number(i.amount), 0) }));
  const { batches: settled, totalDelivered } = settle(costed, totalPaid);
  const balance = totalPaid - totalDelivered;
  return {
    supplierId,
    totalPaid,
    totalDelivered,
    balance,
    owed: Math.max(0, -balance),
    credit: Math.max(0, balance),
    batches: settled,
  };
}

/** Lightweight account summary for many suppliers (used by list pages). */
export async function supplierBalances(
  supplierIds: string[],
): Promise<Map<string, { balance: number; totalPaid: number; totalDelivered: number }>> {
  if (supplierIds.length === 0) return new Map();
  const [payAgg, batches] = await Promise.all([
    prisma.supplierPayment.groupBy({
      by: ["supplierId"],
      _sum: { amount: true },
      where: { supplierId: { in: supplierIds } },
    }),
    prisma.purchaseBatch.findMany({
      where: { supplierId: { in: supplierIds } },
      select: { supplierId: true, items: { select: { amount: true } } },
    }),
  ]);
  const paid = new Map(payAgg.map((p) => [p.supplierId, Number(p._sum.amount ?? 0)]));
  const delivered = new Map<string, number>();
  for (const b of batches) {
    const cost = b.items.reduce((s, i) => s + Number(i.amount), 0);
    delivered.set(b.supplierId, (delivered.get(b.supplierId) ?? 0) + cost);
  }
  const out = new Map<string, { balance: number; totalPaid: number; totalDelivered: number }>();
  for (const id of supplierIds) {
    const tp = paid.get(id) ?? 0;
    const td = delivered.get(id) ?? 0;
    out.set(id, { balance: tp - td, totalPaid: tp, totalDelivered: td });
  }
  return out;
}
