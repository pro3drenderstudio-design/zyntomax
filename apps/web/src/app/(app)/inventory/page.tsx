import { prisma } from "@zyntomax/db";
import { requireSession, accessibleSiteIds } from "@/lib/auth";
import { locationBalances, locationBreakdown } from "@/lib/inventory";
import { PageHeader, Card, StatCard, formatKg } from "@/components/ui";

const KIND_LABEL: Record<string, string> = {
  INTAKE: "Raw material intake",
  STAGE_WIP: "In processing",
  FINISHED_STORE: "Finished goods",
  VEHICLE: "On collection vehicles",
};

export default async function InventoryPage() {
  const session = await requireSession();
  const siteIds = accessibleSiteIds(session);

  const balances = await locationBalances(siteIds);
  const sites = await prisma.site.findMany({
    where: siteIds ? { id: { in: siteIds } } : {},
  });
  const siteName = new Map(sites.map((s) => [s.id, s.name]));

  const withBreakdown = await Promise.all(
    balances
      .filter((b) => Math.abs(b.totalKg) > 0.01)
      .map(async (b) => ({
        ...b,
        breakdown: await locationBreakdown(b.locationId),
      })),
  );

  const totals = {
    intake: balances.filter((b) => b.kind === "INTAKE").reduce((s, b) => s + b.totalKg, 0),
    wip: balances.filter((b) => b.kind === "STAGE_WIP").reduce((s, b) => s + b.totalKg, 0),
    finished: balances.filter((b) => b.kind === "FINISHED_STORE").reduce((s, b) => s + b.totalKg, 0),
  };

  const groups = ["INTAKE", "STAGE_WIP", "FINISHED_STORE", "VEHICLE"] as const;

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Live balances computed from the movement ledger — never hand-edited"
      />

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Raw at intake" value={formatKg(totals.intake)} />
        <StatCard label="In processing" value={formatKg(totals.wip)} />
        <StatCard label="Finished goods" value={formatKg(totals.finished)} tone="accent" />
      </div>

      {groups.map((kind) => {
        const locations = withBreakdown.filter((b) => b.kind === kind);
        if (locations.length === 0) return null;
        return (
          <div key={kind}>
            <h2 className="mb-2 mt-6 font-medium">{KIND_LABEL[kind]}</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {locations.map((b) => (
                <Card key={b.locationId}>
                  <div className="mb-2 flex items-baseline justify-between">
                    <p className="font-medium">{b.stageName ?? b.name}</p>
                    <p className="tabular text-lg font-semibold">{formatKg(b.totalKg)}</p>
                  </div>
                  {sites.length > 1 && (
                    <p className="mb-2 text-xs text-muted">{siteName.get(b.siteId)}</p>
                  )}
                  <ul className="flex flex-col gap-1">
                    {b.breakdown.map((line) => (
                      <li key={line.label} className="flex items-center justify-between text-sm">
                        <span className="text-muted">{line.label}</span>
                        <span className="tabular">{formatKg(line.kg)}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
