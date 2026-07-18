import { prisma, Prisma } from "@zyntomax/db";
import { requireSession, accessibleSiteIds, hasRole } from "@/lib/auth";
import { PageHeader, Card, StatCard, Table, formatNaira, formatKg } from "@/components/ui";
import { DieselForm } from "./diesel-form";
import { DieselChart, type DieselPoint } from "./diesel-chart";
import { subDays, startOfDay, format } from "date-fns";

export default async function DieselPage() {
  const session = await requireSession();
  const siteIds = accessibleSiteIds(session);
  const canLog = hasRole(session, ["FACTORY_SUPERVISOR", "FINANCE_ADMIN", "OPERATIONS_MANAGER"]);

  const from = startOfDay(subDays(new Date(), 29));

  const [logs, outputRows, sites] = await Promise.all([
    prisma.dieselLog.findMany({
      where: { date: { gte: from }, ...(siteIds ? { siteId: { in: siteIds } } : {}) },
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
  ]);

  // Daily series (last 30 days)
  const litresByDay = new Map<string, number>();
  const costByDay = new Map<string, number>();
  for (const l of logs) {
    const k = format(l.date, "yyyy-MM-dd");
    litresByDay.set(k, (litresByDay.get(k) ?? 0) + Number(l.litres));
    costByDay.set(k, (costByDay.get(k) ?? 0) + Number(l.cost ?? 0));
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

  const totalLitres = logs.reduce((s, l) => s + Number(l.litres), 0);
  const totalCost = logs.reduce((s, l) => s + Number(l.cost ?? 0), 0);
  const totalOutput = [...outputByDay.values()].reduce((s, v) => s + v, 0);
  const avgRatio = totalOutput > 0 ? totalLitres / totalOutput : null;
  const last7 = series.slice(-7);
  const l7Litres = last7.reduce((s, p) => s + p.litres, 0);
  const l7Out = last7.reduce((s, p) => s + p.outputKg, 0);
  const ratio7 = l7Out > 0 ? l7Litres / l7Out : null;

  return (
    <div>
      <PageHeader
        title="Diesel usage"
        subtitle="Daily diesel vs finished output — watch the litres/kg trend to catch theft or inefficiency"
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Diesel (30d)" value={`${totalLitres.toLocaleString()} L`} hint={totalCost > 0 ? formatNaira(totalCost) : undefined} />
        <StatCard label="Output (30d)" value={formatKg(totalOutput)} />
        <StatCard label="Avg litres/kg (30d)" value={avgRatio !== null ? avgRatio.toFixed(3) : "—"} tone="accent" />
        <StatCard
          label="This week litres/kg"
          value={ratio7 !== null ? ratio7.toFixed(3) : "—"}
          tone={ratio7 !== null && avgRatio !== null && ratio7 > avgRatio * 1.15 ? "warning" : "default"}
          hint={ratio7 !== null && avgRatio !== null && ratio7 > avgRatio * 1.15 ? "Above 30-day average" : undefined}
        />
      </div>

      <Card className="mt-4">
        <h2 className="mb-3 font-medium">Daily diesel, output & efficiency (30 days)</h2>
        <DieselChart data={series} />
      </Card>

      {canLog && (
        <Card className="mt-4">
          <h2 className="mb-3 font-medium">Log today&apos;s diesel</h2>
          <DieselForm sites={sites.map((s) => ({ id: s.id, name: s.name }))} />
        </Card>
      )}

      <h2 className="mb-2 mt-6 font-medium">Recent logs</h2>
      <Table headers={["Date", "Litres", "Cost", "Note"]}>
        {[...logs].reverse().map((l) => (
          <tr key={l.id}>
            <td className="px-3 py-2">{l.date.toLocaleDateString("en-NG")}</td>
            <td className="tabular px-3 py-2">{Number(l.litres).toLocaleString()} L</td>
            <td className="tabular px-3 py-2">{l.cost ? formatNaira(Number(l.cost)) : "—"}</td>
            <td className="px-3 py-2 text-muted">{l.note ?? "—"}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
