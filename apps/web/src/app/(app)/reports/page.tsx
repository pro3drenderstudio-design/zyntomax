import { prisma } from "@zyntomax/db";
import { requireSession } from "@/lib/auth";
import { PageHeader, Card, StatCard, Table, formatNaira, formatKg } from "@/components/ui";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  await requireSession();
  const { month } = await searchParams;

  const period = month && /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7);
  const [year, m] = period.split("-").map(Number);
  const from = new Date(year, m - 1, 1);
  const to = new Date(year, m, 1);

  const [
    invoiceAgg,
    weighInAgg,
    purchaseItems,
    batchExpenses,
    otherExpenses,
    payrollItems,
    finishedAgg,
    collectionKgAgg,
    wasteRows,
    outputTarget,
    salesTarget,
  ] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: { amount: true },
      where: { createdAt: { gte: from, lt: to } },
    }),
    prisma.collectionWeighIn.aggregate({
      _sum: { amount: true, weightKg: true },
      where: { createdAt: { gte: from, lt: to } },
    }),
    prisma.purchaseBatchItem.aggregate({
      _sum: { amount: true, weightKg: true },
      where: { batch: { scaledInAt: { gte: from, lt: to } } },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        incurredAt: { gte: from, lt: to },
        OR: [{ purchaseBatchId: { not: null } }, { tripId: { not: null } }],
      },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true },
      where: { incurredAt: { gte: from, lt: to }, purchaseBatchId: null, tripId: null },
    }),
    prisma.payrollItem.aggregate({
      _sum: { earnedAmount: true },
      where: { run: { weekStart: { gte: from, lt: to } } },
    }),
    prisma.inventoryMovement.aggregate({
      _sum: { weightKg: true },
      where: { createdAt: { gte: from, lt: to }, toLocation: { kind: "FINISHED_STORE" } },
    }),
    prisma.collectionWeighIn.aggregate({
      _sum: { weightKg: true },
      where: { createdAt: { gte: from, lt: to } },
    }),
    prisma.inventoryMovement.findMany({
      where: { createdAt: { gte: from, lt: to }, toLocation: { kind: "WASTE" } },
      include: { materialType: true },
    }),
    prisma.target.findFirst({
      where: { metric: "FINISHED_OUTPUT_KG", periodYear: year, periodMonth: m, siteId: null, materialTypeId: null },
    }),
    prisma.target.findFirst({
      where: { metric: "SALES_NAIRA", periodYear: year, periodMonth: m, siteId: null, materialTypeId: null },
    }),
  ]);

  const revenue = Number(invoiceAgg._sum.amount ?? 0);
  const vendorCost = Number(weighInAgg._sum.amount ?? 0);
  const purchaseCost = Number(purchaseItems._sum.amount ?? 0);
  const directExpenses = Number(batchExpenses._sum.amount ?? 0);
  const wages = Number(payrollItems._sum.earnedAmount ?? 0);
  const opex = Number(otherExpenses._sum.amount ?? 0);

  const cogs = vendorCost + purchaseCost + directExpenses + wages;
  const grossProfit = revenue - cogs;
  const netProfit = grossProfit - opex;

  const outputKg = Number(finishedAgg._sum.weightKg ?? 0);
  const collectedKg = Number(collectionKgAgg._sum.weightKg ?? 0);
  const purchasedKg = Number(purchaseItems._sum.weightKg ?? 0);
  const wasteKg = wasteRows.reduce((s, w) => s + Number(w.weightKg), 0);
  const wasteByMaterial = new Map<string, number>();
  for (const w of wasteRows) {
    const key = w.materialType?.name ?? "Other";
    wasteByMaterial.set(key, (wasteByMaterial.get(key) ?? 0) + Number(w.weightKg));
  }

  const costPerKg = outputKg > 0 ? cogs / outputKg : null;
  const revPerKg = outputKg > 0 ? revenue / outputKg : null;

  const monthLabel = from.toLocaleDateString("en-NG", { month: "long", year: "numeric" });

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle={monthLabel}
        action={
          <form action="/reports" className="flex items-center gap-2">
            <label htmlFor="r-month" className="text-sm text-muted">Month</label>
            <input
              id="r-month" type="month" name="month" defaultValue={period}
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm"
            />
            <button type="submit" className="cursor-pointer rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-muted-bg">
              View
            </button>
          </form>
        }
      />

      {/* P&L */}
      <Card className="mb-4">
        <h2 className="mb-3 font-medium">Profit & loss — {monthLabel}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-max text-sm">
            <tbody className="divide-y divide-border">
              <tr>
                <td className="py-2 font-medium">Revenue (invoiced sales)</td>
                <td className="tabular py-2 text-right font-medium">{formatNaira(revenue)}</td>
              </tr>
              <tr>
                <td className="py-2 pl-4 text-muted">Vendor collections cost</td>
                <td className="tabular py-2 text-right text-muted">−{formatNaira(vendorCost)}</td>
              </tr>
              <tr>
                <td className="py-2 pl-4 text-muted">Raw material purchases</td>
                <td className="tabular py-2 text-right text-muted">−{formatNaira(purchaseCost)}</td>
              </tr>
              <tr>
                <td className="py-2 pl-4 text-muted">Direct expenses (tied to batches/trips)</td>
                <td className="tabular py-2 text-right text-muted">−{formatNaira(directExpenses)}</td>
              </tr>
              <tr>
                <td className="py-2 pl-4 text-muted">Production wages</td>
                <td className="tabular py-2 text-right text-muted">−{formatNaira(wages)}</td>
              </tr>
              <tr className="bg-muted-bg">
                <td className="py-2 font-medium">Gross profit</td>
                <td className={`tabular py-2 text-right font-semibold ${grossProfit < 0 ? "text-destructive" : "text-accent"}`}>
                  {formatNaira(grossProfit)}
                </td>
              </tr>
              <tr>
                <td className="py-2 pl-4 text-muted">Operating expenses</td>
                <td className="tabular py-2 text-right text-muted">−{formatNaira(opex)}</td>
              </tr>
              <tr className="bg-muted-bg">
                <td className="py-2 text-base font-semibold">Net profit</td>
                <td className={`tabular py-2 text-right text-base font-bold ${netProfit < 0 ? "text-destructive" : "text-accent"}`}>
                  {formatNaira(netProfit)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      {/* Operations KPIs */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Finished output"
          value={formatKg(outputKg)}
          hint={
            outputTarget
              ? outputKg >= Number(outputTarget.value)
                ? "Target reached"
                : `${formatKg(Number(outputTarget.value) - outputKg)} left of ${formatKg(Number(outputTarget.value))}`
              : "No target set"
          }
          tone={outputTarget && outputKg >= Number(outputTarget.value) ? "accent" : "default"}
        />
        <StatCard label="Collected from vendors" value={formatKg(collectedKg)} />
        <StatCard label="Purchased raw" value={formatKg(purchasedKg)} />
        <StatCard
          label="Waste & losses"
          value={formatKg(wasteKg)}
          tone={wasteKg > outputKg * 0.2 ? "warning" : "default"}
        />
      </div>

      {/* Unit economics */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-medium">Unit economics</h2>
          {costPerKg === null ? (
            <p className="py-4 text-center text-sm text-muted">
              No finished output this month yet.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md bg-muted-bg px-3 py-2">
                <p className="text-xs text-muted">Cost per finished kg</p>
                <p className="tabular text-lg font-semibold">{formatNaira(costPerKg)}</p>
              </div>
              <div className="rounded-md bg-muted-bg px-3 py-2">
                <p className="text-xs text-muted">Revenue per kg</p>
                <p className="tabular text-lg font-semibold">{revPerKg ? formatNaira(revPerKg) : "—"}</p>
              </div>
              <div className="rounded-md bg-muted-bg px-3 py-2">
                <p className="text-xs text-muted">Margin per kg</p>
                <p className={`tabular text-lg font-semibold ${revPerKg && revPerKg - costPerKg < 0 ? "text-destructive" : "text-accent"}`}>
                  {revPerKg ? formatNaira(revPerKg - costPerKg) : "—"}
                </p>
              </div>
            </div>
          )}
          {salesTarget && (
            <p className="tabular mt-3 text-sm text-muted">
              Sales target: {formatNaira(Number(salesTarget.value))} · achieved {formatNaira(revenue)} (
              {Math.round((revenue / Number(salesTarget.value)) * 100)}%)
            </p>
          )}
        </Card>

        <Card>
          <h2 className="mb-3 font-medium">Waste by material</h2>
          {wasteByMaterial.size === 0 ? (
            <p className="py-4 text-center text-sm text-muted">No waste recorded this month.</p>
          ) : (
            <Table headers={["Material", "Waste kg"]}>
              {[...wasteByMaterial.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([name, kg]) => (
                  <tr key={name}>
                    <td className="px-3 py-2">{name}</td>
                    <td className="tabular px-3 py-2">{formatKg(kg)}</td>
                  </tr>
                ))}
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
