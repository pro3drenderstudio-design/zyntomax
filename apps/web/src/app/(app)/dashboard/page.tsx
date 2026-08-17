import Link from "next/link";
import { prisma } from "@zyntomax/db";
import { requireSession, accessibleSiteIds } from "@/lib/auth";
import { inventoryBuckets } from "@/lib/inventory";
import { PageHeader, StatCard, Card, Badge, statusTone, formatKg, formatNaira } from "@/components/ui";
import { startOfMonth, startOfDay } from "date-fns";

export default async function DashboardPage() {
  const session = await requireSession();
  const siteIds = accessibleSiteIds(session);
  const siteWhere = siteIds ? { siteId: { in: siteIds } } : {};

  const now = new Date();
  const monthStart = startOfMonth(now);
  const dayStart = startOfDay(now);

  const [
    vendorCount,
    activeTrips,
    todayCollected,
    flaggedJobs,
    buckets,
    walletAgg,
    pendingBatches,
    monthOutput,
    monthTargets,
    openInvoices,
    monthCollected,
    monthPurchased,
    monthSales,
    pendingPickups,
  ] = await Promise.all([
    prisma.vendor.count({ where: { ...siteWhere, status: "ACTIVE" } }),
    prisma.trip.findMany({
      where: { ...siteWhere, status: { in: ["PLANNED", "IN_PROGRESS", "RETURNED"] } },
      include: {
        lead: { include: { user: true } },
        weighIns: { select: { weightKg: true, amount: true } },
        locality: true,
      },
      orderBy: { date: "desc" },
      take: 6,
    }),
    prisma.collectionWeighIn.aggregate({
      _sum: { weightKg: true, amount: true },
      where: { createdAt: { gte: dayStart }, trip: siteWhere },
    }),
    prisma.job.count({ where: { ...siteWhere, status: "FLAGGED" } }),
    inventoryBuckets(siteIds),
    prisma.walletTransaction.aggregate({ _sum: { amount: true } }),
    prisma.payoutBatch.findMany({
      where: { status: { in: ["AWAITING_FUNDS", "READY", "PROCESSING", "PARTIAL_FAILED"] } },
      include: { trip: { include: { locality: true } } },
      take: 5,
    }),
    prisma.inventoryMovement.aggregate({
      _sum: { weightKg: true },
      where: {
        createdAt: { gte: monthStart },
        toLocation: { kind: "FINISHED_STORE", ...(siteIds ? { siteId: { in: siteIds } } : {}) },
      },
    }),
    prisma.target.findMany({
      where: { periodYear: now.getFullYear(), periodMonth: now.getMonth() + 1 },
      include: { materialType: true },
    }),
    prisma.invoice.aggregate({
      _sum: { amount: true },
      where: { status: { in: ["UNPAID", "PARTIAL", "OVERDUE"] } },
    }),
    prisma.collectionWeighIn.aggregate({
      _sum: { weightKg: true },
      where: { createdAt: { gte: monthStart }, trip: siteWhere },
    }),
    prisma.purchaseBatchItem.aggregate({
      _sum: { weightKg: true },
      where: { batch: { scaledInAt: { gte: monthStart }, ...siteWhere } },
    }),
    prisma.invoice.aggregate({
      _sum: { amount: true },
      where: { createdAt: { gte: monthStart } },
    }),
    prisma.pickupRequest.count({
      where: { status: "PENDING", ...(siteIds ? { vendor: { siteId: { in: siteIds } } } : {}) },
    }),
  ]);

  const sumKg = (arr: { kg: number }[]) => arr.reduce((s, m) => s + m.kg, 0);
  const wipTotal = sumKg(buckets.waiting) + buckets.active.reduce((s, st) => s + sumKg(st.materials), 0);
  const intakeTotal = sumKg(buckets.raw);
  const finishedTotal = sumKg(buckets.finished);

  const walletBalance = Number(walletAgg._sum.amount ?? 0);
  const monthActual: Record<string, number> = {
    FINISHED_OUTPUT_KG: Number(monthOutput._sum.weightKg ?? 0),
    COLLECTION_KG: Number(monthCollected._sum.weightKg ?? 0),
    PURCHASE_KG: Number(monthPurchased._sum.weightKg ?? 0),
    SALES_NAIRA: Number(monthSales._sum.amount ?? 0),
  };
  const TARGET_LABEL: Record<string, string> = {
    FINISHED_OUTPUT_KG: "Finished output",
    COLLECTION_KG: "Collection",
    PURCHASE_KG: "Purchases",
    SALES_NAIRA: "Sales",
  };

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={now.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Active vendors" value={vendorCount} />
        <StatCard
          label="Collected today"
          value={formatKg(Number(todayCollected._sum.weightKg ?? 0))}
          hint={formatNaira(Number(todayCollected._sum.amount ?? 0)) + " owed"}
        />
        <StatCard label="Raw at intake" value={formatKg(intakeTotal)} />
        <StatCard label="In processing" value={formatKg(wipTotal)} />
        <StatCard label="Finished goods" value={formatKg(finishedTotal)} />
        <StatCard
          label="Wallet balance"
          value={formatNaira(walletBalance)}
          tone={walletBalance <= 0 ? "destructive" : "default"}
        />
      </div>

      {monthTargets.length > 0 && (
        <Card className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-medium">Monthly targets — {now.toLocaleDateString("en-NG", { month: "long" })}</p>
            <Link href="/budgets" className="text-sm text-accent hover:underline">Edit targets</Link>
          </div>
          <div className="flex flex-col gap-3">
            {monthTargets.map((t) => {
              const target = Number(t.value);
              const actual = monthActual[t.metric] ?? 0;
              const pct = target > 0 ? (actual / target) * 100 : 0;
              const naira = t.metric === "SALES_NAIRA";
              const fmt = (n: number) => (naira ? formatNaira(n) : formatKg(n));
              return (
                <div key={t.id}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="font-medium">
                      {TARGET_LABEL[t.metric] ?? t.metric}{t.materialType ? ` · ${t.materialType.name}` : ""} — {fmt(target)}
                    </span>
                    <span className="text-muted">{actual >= target ? "Reached 🎯" : `${fmt(target - actual)} to go`}</span>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted-bg" role="progressbar" aria-valuenow={Math.min(100, Math.round(pct))} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${Math.min(100, pct)}%` }} />
                  </div>
                  <p className="tabular mt-1 text-xs text-muted">{fmt(actual)} so far ({Math.round(pct)}%)</p>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Trips in the field</h2>
            <Link href="/trips" className="text-sm text-accent hover:underline">
              All trips
            </Link>
          </div>
          {activeTrips.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              No active trips right now.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {activeTrips.map((t) => {
                const kg = t.weighIns.reduce((s, w) => s + Number(w.weightKg), 0);
                return (
                  <li key={t.id} className="flex items-center justify-between gap-2 py-2">
                    <div className="min-w-0">
                      <Link href={`/trips/${t.id}`} className="truncate text-sm font-medium hover:underline">
                        {t.locality?.name ?? "Route"} — {t.lead.user.name}
                      </Link>
                      <p className="text-xs text-muted">
                        {t.date.toLocaleDateString("en-NG")} · {t.weighIns.length} weigh-ins
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="tabular text-sm font-medium">{formatKg(kg)}</span>
                      <Badge tone={statusTone(t.status)}>{t.status.replace(/_/g, " ")}</Badge>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Needs attention</h2>
          </div>
          <ul className="flex flex-col gap-2 text-sm">
            {pendingPickups > 0 && (
              <li>
                <Link href="/pickups?status=PENDING" className="flex items-center justify-between rounded-md bg-warning-soft px-3 py-2 text-warning hover:opacity-90">
                  <span>{pendingPickups} pickup request{pendingPickups > 1 ? "s" : ""} awaiting a collector</span>
                  <span aria-hidden>→</span>
                </Link>
              </li>
            )}
            {flaggedJobs > 0 && (
              <li>
                <Link href="/production?status=FLAGGED" className="flex items-center justify-between rounded-md bg-destructive-soft px-3 py-2 text-destructive hover:opacity-90">
                  <span>{flaggedJobs} production job{flaggedJobs > 1 ? "s" : ""} flagged for discrepancy</span>
                  <span aria-hidden>→</span>
                </Link>
              </li>
            )}
            {pendingBatches.map((b) => (
              <li key={b.id}>
                <Link href={`/payouts`} className="flex items-center justify-between rounded-md bg-warning-soft px-3 py-2 text-warning hover:opacity-90">
                  <span>
                    Payout batch — {b.trip.locality?.name ?? "trip"} ·{" "}
                    {formatNaira(Number(b.totalAmount))}
                  </span>
                  <Badge tone={statusTone(b.status)}>{b.status.replace(/_/g, " ")}</Badge>
                </Link>
              </li>
            ))}
            {Number(openInvoices._sum.amount ?? 0) > 0 && (
              <li>
                <Link href="/invoices" className="flex items-center justify-between rounded-md bg-info-soft px-3 py-2 text-info hover:opacity-90">
                  <span>Open receivables</span>
                  <span className="tabular font-medium">
                    {formatNaira(Number(openInvoices._sum.amount ?? 0))}
                  </span>
                </Link>
              </li>
            )}
            {pendingPickups === 0 && flaggedJobs === 0 && pendingBatches.length === 0 && Number(openInvoices._sum.amount ?? 0) === 0 && (
              <li className="py-6 text-center text-muted">All clear. Nothing pending.</li>
            )}
          </ul>
        </Card>
      </div>

      {buckets.active.length > 0 && (
        <Card className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Material in each stage</h2>
            <Link href="/inventory" className="text-sm text-accent hover:underline">
              Full inventory
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {buckets.active.map((st) => (
              <div key={st.stageId} className="rounded-md bg-muted-bg px-3 py-2">
                <p className="text-xs text-muted">{st.stageName}</p>
                <p className="tabular text-lg font-semibold">
                  {formatKg(st.materials.reduce((s, m) => s + m.kg, 0))}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
