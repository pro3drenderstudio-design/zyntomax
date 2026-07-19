import Link from "next/link";
import { requireSession, accessibleSiteIds } from "@/lib/auth";
import { inventoryBuckets, type MaterialStock } from "@/lib/inventory";
import { PageHeader, Card, StatCard, formatKg } from "@/components/ui";

function MaterialChip({ m }: { m: MaterialStock }) {
  return (
    <Link
      href={`/inventory/${m.materialId}`}
      className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2 hover:bg-muted-bg"
    >
      <span className="flex items-center gap-2 truncate">
        <span className="inline-block h-3 w-3 shrink-0 rounded-full border border-border" style={{ backgroundColor: m.color ?? "#cbd5e1" }} aria-hidden />
        <span className="truncate text-sm">{m.name}</span>
      </span>
      <span className="tabular shrink-0 text-sm font-semibold">{formatKg(m.kg)}</span>
    </Link>
  );
}

export default async function InventoryPage() {
  const session = await requireSession();
  const siteIds = accessibleSiteIds(session);
  const b = await inventoryBuckets(siteIds);

  const sum = (arr: MaterialStock[]) => arr.reduce((s, m) => s + m.kg, 0);
  const rawTotal = sum(b.raw);
  const waitingTotal = sum(b.waiting);
  const activeTotal = b.active.reduce((s, st) => s + sum(st.materials), 0);
  const finishedTotal = sum(b.finished);

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle="Live balances from the movement ledger — raw stock, materials in processing, and finished goods"
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Raw (pre-processing)" value={formatKg(rawTotal)} />
        <StatCard label="Waiting to process" value={formatKg(waitingTotal)} />
        <StatCard label="Active in stages" value={formatKg(activeTotal)} tone="warning" />
        <StatCard label="Finished goods" value={formatKg(finishedTotal)} tone="accent" />
      </div>

      {/* Raw */}
      <h2 className="mb-2 mt-6 font-medium">Raw materials — pre-processing</h2>
      {b.raw.length === 0 ? (
        <Card><p className="py-4 text-center text-sm text-muted">No raw stock. Purchase or collect materials to fill intake.</p></Card>
      ) : (
        <div className="grid gap-2 md:grid-cols-3">{b.raw.map((m) => <MaterialChip key={m.materialId} m={m} />)}</div>
      )}

      {/* In processing */}
      <h2 className="mb-2 mt-6 font-medium">In processing</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-2 text-sm font-medium text-muted">Waiting for the next stage</h3>
          {b.waiting.length === 0 ? (
            <p className="py-3 text-center text-sm text-muted">Nothing waiting.</p>
          ) : (
            <div className="grid gap-2">{b.waiting.map((m) => <MaterialChip key={m.materialId} m={m} />)}</div>
          )}
        </Card>
        <Card>
          <h3 className="mb-2 text-sm font-medium text-muted">Being worked right now (by stage)</h3>
          {b.active.length === 0 ? (
            <p className="py-3 text-center text-sm text-muted">No active jobs.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {b.active.map((st) => (
                <div key={st.stageId}>
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">{st.stageName}</p>
                  <div className="grid gap-2">{st.materials.map((m) => <MaterialChip key={m.materialId} m={m} />)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Finished */}
      <h2 className="mb-2 mt-6 font-medium">Finished goods — ready for sale</h2>
      {b.finished.length === 0 ? (
        <Card><p className="py-4 text-center text-sm text-muted">No finished goods yet.</p></Card>
      ) : (
        <div className="grid gap-2 md:grid-cols-3">{b.finished.map((m) => <MaterialChip key={m.materialId} m={m} />)}</div>
      )}
    </div>
  );
}
