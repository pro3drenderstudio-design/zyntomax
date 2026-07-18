import { prisma, Prisma } from "@zyntomax/db";

export type ReportType = "pnl" | "production" | "purchases" | "sales";

export function reportPeriod(month?: string) {
  const period = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
  const [year, m] = period.split("-").map(Number);
  return { period, from: new Date(year, m - 1, 1), to: new Date(year, m, 1), year, month: m };
}

export const REPORT_TITLES: Record<ReportType, string> = {
  pnl: "Profit & Loss Statement",
  production: "Production Report",
  purchases: "Purchases Report",
  sales: "Sales Report",
};

export async function pnlReport(from: Date, to: Date) {
  const [invoiceAgg, weighInAgg, purchaseItems, batchExpenses, otherExpenses, payrollItems, finishedAgg] =
    await Promise.all([
      prisma.invoice.aggregate({ _sum: { amount: true }, where: { createdAt: { gte: from, lt: to } } }),
      prisma.collectionWeighIn.aggregate({ _sum: { amount: true }, where: { createdAt: { gte: from, lt: to } } }),
      prisma.purchaseBatchItem.aggregate({ _sum: { amount: true, weightKg: true }, where: { batch: { scaledInAt: { gte: from, lt: to } } } }),
      prisma.expense.aggregate({ _sum: { amount: true }, where: { incurredAt: { gte: from, lt: to }, OR: [{ purchaseBatchId: { not: null } }, { tripId: { not: null } }] } }),
      prisma.expense.aggregate({ _sum: { amount: true }, where: { incurredAt: { gte: from, lt: to }, purchaseBatchId: null, tripId: null } }),
      prisma.payrollItem.aggregate({ _sum: { earnedAmount: true }, where: { run: { weekStart: { gte: from, lt: to } } } }),
      prisma.inventoryMovement.aggregate({ _sum: { weightKg: true }, where: { createdAt: { gte: from, lt: to }, toLocation: { kind: "FINISHED_STORE" } } }),
    ]);
  const revenue = Number(invoiceAgg._sum.amount ?? 0);
  const vendorCost = Number(weighInAgg._sum.amount ?? 0);
  const purchaseCost = Number(purchaseItems._sum.amount ?? 0);
  const directExpenses = Number(batchExpenses._sum.amount ?? 0);
  const wages = Number(payrollItems._sum.earnedAmount ?? 0);
  const opex = Number(otherExpenses._sum.amount ?? 0);
  const cogs = vendorCost + purchaseCost + directExpenses + wages;
  return {
    revenue, vendorCost, purchaseCost, directExpenses, wages, opex,
    cogs, grossProfit: revenue - cogs, netProfit: revenue - cogs - opex,
    outputKg: Number(finishedAgg._sum.weightKg ?? 0),
  };
}

export async function productionReport(from: Date, to: Date) {
  const rows = await prisma.$queryRaw<
    { stage: string; material: string; jobs: bigint; inKg: number; outKg: number; wasteKg: number }[]
  >(Prisma.sql`
    SELECT s.name AS stage, m.name AS material, COUNT(*) AS jobs,
      SUM(j."weightInKg") AS "inKg",
      SUM(COALESCE(j."weightOutKg",0)) AS "outKg",
      SUM(COALESCE(j."wasteKg",0)) AS "wasteKg"
    FROM "Job" j
    JOIN "ProcessStage" s ON s.id = j."stageId"
    JOIN "MaterialType" m ON m.id = j."materialTypeId"
    WHERE j."completedAt" >= ${from} AND j."completedAt" < ${to}
      AND j.status IN ('COMPLETED','RESOLVED')
    GROUP BY s.name, m.name ORDER BY s.name, m.name
  `);
  return rows.map((r) => ({
    stage: r.stage, material: r.material, jobs: Number(r.jobs),
    inKg: Number(r.inKg), outKg: Number(r.outKg), wasteKg: Number(r.wasteKg),
    discrepancyKg: Number(r.inKg) - Number(r.outKg) - Number(r.wasteKg),
  }));
}

export async function purchasesReport(from: Date, to: Date) {
  const batches = await prisma.purchaseBatch.findMany({
    where: { scaledInAt: { gte: from, lt: to } },
    include: { supplier: { include: { type: true } }, items: true, expenses: true },
    orderBy: { scaledInAt: "asc" },
  });
  return batches.map((b) => {
    const kg = b.items.reduce((s, i) => s + Number(i.weightKg), 0);
    const material = b.items.reduce((s, i) => s + Number(i.amount), 0);
    const exp = b.expenses.reduce((s, e) => s + Number(e.amount), 0);
    return {
      lotNo: b.lotNo, date: b.scaledInAt!, supplier: b.supplier.name, type: b.supplier.type?.name ?? "—",
      kg, materialCost: material, expenses: exp, landedPerKg: kg > 0 ? (material + exp) / kg : 0,
    };
  });
}

export async function salesReport(from: Date, to: Date) {
  const orders = await prisma.salesOrder.findMany({
    where: { createdAt: { gte: from, lt: to } },
    include: { customer: true, items: { include: { product: true } }, invoice: { include: { payments: true } } },
    orderBy: { createdAt: "asc" },
  });
  return orders.map((o) => {
    const total = o.items.reduce((s, i) => s + Number(i.qtyKg) * Number(i.unitPrice), 0);
    const paid = o.invoice?.payments.reduce((s, p) => s + Number(p.amount), 0) ?? 0;
    return {
      orderNo: o.orderNo, date: o.createdAt, customer: o.customer.name,
      items: o.items.map((i) => (i.isInventory ? i.product?.name : i.description)).filter(Boolean).join(", "),
      total, paid, outstanding: total - paid,
    };
  });
}
