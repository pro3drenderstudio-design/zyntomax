import { prisma, Prisma } from "@zyntomax/db";
import { requireSession, accessibleSiteIds, hasRole } from "@/lib/auth";
import { PageHeader, Card, StatCard, Table, Badge, formatNaira } from "@/components/ui";
import { DieselForm, DieselPurchaseForm } from "./diesel-form";
import { DieselChart, type DieselPoint } from "./diesel-chart";
import { subDays, startOfDay, format } from "date-fns";

export default async function DieselPage() {
  const session = await requireSession();
  const siteIds = accessibleSiteIds(session);
  const canLog = hasRole(session, ["FACTORY_SUPERVISOR", "FINANCE_ADMIN", "OPERATIONS_MANAGER"]);
  const canPurchase = hasRole(session, ["FINANCE_ADMIN", "OPERATIONS_MANAGER"]);

  const from = startOfDay(subDays(new Date(), 29));
  const siteFilter = siteIds ? { siteId: { in: siteIds } } : {};

  const [logs, outputRows, sites, totals] = await Promise.all([
    prisma.dieselLog.findMany({
      where: { date: { gte: from }, ...siteFilter },
      orderBy: { date: "asc" },
    }),
    prisma.$queryRaw<{ day: string; kg: number }[]>(Prisma.sql`
      SELECT to_char(date_trunc('day', mv."createdAt"), 'YYYY-MM-DD') AS day, SUM(mv."weightKg") AS kg
      FROM "InventoryMovement" mv
      JOIN "InventoryLocation" l ON l.id = mv."toLocationId"
      WHERE l.kind = 'FINISHED_STORE' AND mv."createdAt" >= ${from}
      GROUP BY 1 ORDER BY 1
    `),
    prisma.site.findMany({ where: { active: true, ...(siteIds ? { id: { in: siteIds } } : {}) } }),
    prisma.dieselLog.groupBy({ by: ["kind"], where: siteFilter, _sum: { litres: true } }),
  ]);

  // All-time available = purchased − used
  let purchasedAll = 0, usedAll = 0;
  for (const t of totals) {
    if (t.kind === "PURCHASE") purchasedAll = Number(t._sum.litres ?? 0);
    else usedAll = Number(t._sum.litres ?? 0);
  }
  const available = purchasedAll - usedAll;

  const usageLogs = logs.filter((l) => l.kind === "USAGE");
  const purchaseLogs = logs.filter((l) => l.kind === "PURCHASE");

  // Daily usage series (last 30 days) vs output
  const litresByDay = new Map<string, number>();
  for (const l of usageLogs) {
    const k = format(l.date, "yyyy-MM-dd");
    litresByDay.set(k, (litresByDay.get(k) ?? 0) + Number(l.litres));
  }
  const outputByDay = new Map(outputRows.map((r) => [r.day, Number(r.kg)]));

  const series: DieselPoint[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = format(subDays(new Date(), i), "yyyy-MM-dd");
    const litres = litresByDay.get(d) ?? 0;
    const outputKg = outputByDay.get(d) ?? 0;
    series.push({
      label: format(subDays(new Date(), i), "d MMM"),
      litres: Math.round(litres * 10) / 10,
      outputKg: Math.round(outputKg),
      litresPerKg: outputKg > 0 ? Math.round((litres / outputKg) * 1000) / 1000 : null,
    });
  }

  const usedLitres = usageLogs.reduce((s, l) => s + Number(l.litres), 0);
  const purchasedLitres = purchaseLogs.reduce((s, l) => s + Number(l.litres), 0);
  const purchaseCost = purchaseLogs.reduce((s, l) => s + Number(l.cost ?? 0), 0);
  const totalOutput = [...outputByDay.values()].reduce((s, v) => s + v, 0);
  const avgRatio = totalOutput > 0 ? usedLitres / totalOutput : null;

  return (
    <div>
      <PageHeader
        title="Diesel"
        subtitle="Purchases, usage and litres remaining — plus the litres/kg trend to catch theft or inefficiency"
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label="Available now"
          value={`${available.toLocaleString(undefined, { maximumFractionDigits: 1 })} L`}
          tone={available <= 0 ? "destructive" : "accent"}
        />
        <StatCard label="Purchased (30d)" value={`${purchasedLitres.toLocaleString()} L`} hint={purchaseCost > 0 ? formatNaira(purchaseCost) : undefined} />
        <StatCard label="Used (30d)" value={`${usedLitres.toLocaleString()} L`} />
        <StatCard label="Avg litres/kg (30d)" value={avgRatio !== null ? avgRatio.toFixed(3) : "—"} tone="accent" />
      </div>

      <Card className="mt-4">
        <h2 className="mb-3 font-medium">Daily usage, output & efficiency (30 days)</h2>
        <DieselChart data={series} />
      </Card>

      {canPurchase && (
        <Card className="mt-4">
          <h2 className="mb-3 font-medium">Record diesel purchase</h2>
          <DieselPurchaseForm sites={sites.map((s) => ({ id: s.id, name: s.name }))} />
        </Card>
      )}

      {canLog && (
        <Card className="mt-4">
          <h2 className="mb-3 font-medium">Log diesel usage</h2>
          <DieselForm sites={sites.map((s) => ({ id: s.id, name: s.name }))} />
        </Card>
      )}

      <h2 className="mb-2 mt-6 font-medium">Recent entries</h2>
      <Table headers={["Date", "Type", "Litres", "Cost", "Note"]}>
        {[...logs].reverse().map((l) => (
          <tr key={l.id}>
            <td className="px-3 py-2">{l.date.toLocaleDateString("en-NG")}</td>
            <td className="px-3 py-2">
              <Badge tone={l.kind === "PURCHASE" ? "success" : "neutral"}>{l.kind === "PURCHASE" ? "Purchase" : "Usage"}</Badge>
            </td>
            <td className="tabular px-3 py-2">{l.kind === "PURCHASE" ? "+" : "−"}{Number(l.litres).toLocaleString()} L</td>
            <td className="tabular px-3 py-2">{l.cost ? formatNaira(Number(l.cost)) : "—"}</td>
            <td className="px-3 py-2 text-muted">{l.note ?? "—"}</td>
          </tr>
        ))}
        {logs.length === 0 && (
          <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-muted">No diesel entries in the last 30 days.</td></tr>
        )}
      </Table>
    </div>
  );
}
