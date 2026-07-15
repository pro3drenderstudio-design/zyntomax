import Link from "next/link";
import { prisma } from "@zyntomax/db";
import { requireSession, accessibleSiteIds } from "@/lib/auth";
import { locationBalances } from "@/lib/inventory";
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
    balances,
    walletAgg,
    pendingBatches,
    monthOutput,
    outputTarget,
    openInvoices,
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
    locationBalances(siteIds),
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
    prisma.target.findFirst({
      where: {
        metric: "FINISHED_OUTPUT_KG",
        periodYear: now.getFullYear(),
        periodMonth: now.getMonth() + 1,
        materialTypeId: null,
        ...(siteIds ? { siteId: { in: [...siteIds, ] } } : { siteId: null }),
      },
    }),
    prisma.invoice.aggregate({
      _sum: { amount: true },
      where: { status: { in: ["UNPAID", "PARTIAL", "OVERDUE"] } },
    }),
  ]);

  const wipTotal = balances
    .filter((b) => b.kind === "STAGE_WIP")
    .reduce((s, b) => s + b.totalKg, 0);
  const intakeTotal = balances
    .filter((b) => b.kind === "INTAKE")
    .reduce((s, b) => s + b.totalKg, 0);
  const finishedTotal = balances
    .filter((b) => b.kind === "FINISHED_STORE")
    .reduce((s, b) => s + b.totalKg, 0);

  const walletBalance = Number(walletAgg._sum.amount ?? 0);
  const outputKg = Number(monthOutput._sum.weightKg ?? 0);
  const targetKg = outputTarget ? Number(outputTarget.value) : null;

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

      {targetKg !== null && (
        <Card className="mt-4">
          <div className="mb-1 flex items-baseline justify-between">
            <p className="text-sm font-medium">
              Monthly output goal — {formatKg(targetKg)}
            </p>
            <p className="text-sm text-muted">
              {outputKg >= targetKg
                ? "Goal reached 🎯"
                : `${formatKg(targetKg - outputKg)} remaining`}
            </p>
          </div>
          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-muted-bg"
            role="progressbar"
            aria-valuenow={Math.min(100, Math.round((outputKg / targetKg) * 100))}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{ width: `${Math.min(100, (outputKg / targetKg) * 100)}%` }}
            />
          </div>
          <p className="tabular mt-1 text-xs text-muted">
            {formatKg(outputKg)} produced this month (
            {Math.round((outputKg / targetKg) * 100)}%)
          </p>
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
            {flaggedJobs === 0 && pendingBatches.length === 0 && Number(openInvoices._sum.amount ?? 0) === 0 && (
              <li className="py-6 text-center text-muted">All clear. Nothing pending.</li>
            )}
          </ul>
        </Card>
      </div>

      {balances.filter((b) => b.kind === "STAGE_WIP" && b.totalKg > 0).length > 0 && (
        <Card className="mt-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-medium">Material in each stage</h2>
            <Link href="/inventory" className="text-sm text-accent hover:underline">
              Full inventory
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {balances
              .filter((b) => b.kind === "STAGE_WIP" && b.totalKg > 0)
              .map((b) => (
                <div key={b.locationId} className="rounded-md bg-muted-bg px-3 py-2">
                  <p className="text-xs text-muted">{b.stageName ?? b.name}</p>
                  <p className="tabular text-lg font-semibold">{formatKg(b.totalKg)}</p>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}
