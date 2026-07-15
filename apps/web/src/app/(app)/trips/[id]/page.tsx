import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@zyntomax/db";
import { requireSession, hasRole } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import {
  PageHeader, Card, Badge, statusTone, Table, StatCard,
  formatKg, formatNaira, buttonClass, secondaryButtonClass,
} from "@/components/ui";
import { setTripStatus, approveTrip } from "../actions";
import { WeighInForm } from "./weighin-form";
import { ReconcileForm } from "./reconcile-form";

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const trip = await prisma.trip.findUnique({
    where: { id },
    include: {
      locality: true,
      lead: { include: { user: true } },
      members: { include: { staff: { include: { user: true } } } },
      weighIns: {
        include: { vendor: true, materialType: true },
        orderBy: { createdAt: "desc" },
      },
      reconciliation: { include: { items: { include: { materialType: true } } } },
      payoutBatch: { include: { payouts: true } },
    },
  });
  if (!trip) notFound();

  const tolerance = await getSetting<number>("collection.tolerance_pct", 3, trip.siteId);

  const [vendors, materials] = await Promise.all([
    prisma.vendor.findMany({
      where: { siteId: trip.siteId, status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.materialType.findMany({ where: { active: true }, select: { id: true, name: true } }),
  ]);

  const totalKg = trip.weighIns.reduce((s, w) => s + Number(w.weightKg), 0);
  const totalOwed = trip.weighIns.reduce((s, w) => s + Number(w.amount), 0);
  const vendorCount = new Set(trip.weighIns.map((w) => w.vendorId)).size;

  const byMaterial = new Map<string, { name: string; kg: number }>();
  for (const w of trip.weighIns) {
    const cur = byMaterial.get(w.materialTypeId) ?? { name: w.materialType.name, kg: 0 };
    cur.kg += Number(w.weightKg);
    byMaterial.set(w.materialTypeId, cur);
  }

  const canOps = hasRole(session, ["OPERATIONS_MANAGER", "TEAM_LEAD"], trip.siteId);
  const canSupervise = hasRole(session, ["FACTORY_SUPERVISOR", "OPERATIONS_MANAGER"], trip.siteId);
  const inField = ["PLANNED", "IN_PROGRESS"].includes(trip.status);

  return (
    <div>
      <PageHeader
        title={`Trip — ${trip.locality?.name ?? "Route"}`}
        subtitle={`${trip.date.toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" })} · Lead: ${trip.lead.user.name}${trip.vehicle ? ` · ${trip.vehicle}` : ""}`}
        action={<Badge tone={statusTone(trip.status)}>{trip.status.replace(/_/g, " ")}</Badge>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total collected" value={formatKg(totalKg)} />
        <StatCard label="Vendors visited" value={vendorCount} />
        <StatCard label="Owed to vendors" value={formatNaira(totalOwed)} />
        <StatCard
          label="Team"
          value={trip.members.length + 1}
          hint={[trip.lead.user.name, ...trip.members.map((m) => m.staff.user.name)].join(", ")}
        />
      </div>

      {/* Status actions */}
      {canOps && (trip.status === "PLANNED" || trip.status === "IN_PROGRESS") && (
        <div className="mt-4 flex gap-2">
          {trip.status === "PLANNED" && (
            <>
              <form action={setTripStatus.bind(null, trip.id, "IN_PROGRESS")}>
                <button type="submit" className={buttonClass}>Start trip</button>
              </form>
              <form action={setTripStatus.bind(null, trip.id, "CANCELLED")}>
                <button type="submit" className={secondaryButtonClass}>Cancel</button>
              </form>
            </>
          )}
          {trip.status === "IN_PROGRESS" && (
            <form action={setTripStatus.bind(null, trip.id, "RETURNED")}>
              <button type="submit" className={buttonClass}>
                Mark returned to factory
              </button>
            </form>
          )}
        </div>
      )}

      {/* Manifest by material */}
      {byMaterial.size > 0 && (
        <Card className="mt-4">
          <h2 className="mb-2 font-medium">Manifest by material</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {[...byMaterial.values()].map((m) => (
              <div key={m.name} className="rounded-md bg-muted-bg px-3 py-2">
                <p className="text-xs text-muted">{m.name}</p>
                <p className="tabular text-lg font-semibold">{formatKg(m.kg)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Weigh-in entry while in the field */}
      {inField && canOps && (
        <Card className="mt-4">
          <h2 className="mb-3 font-medium">Record weigh-in</h2>
          <WeighInForm tripId={trip.id} vendors={vendors} materials={materials} />
        </Card>
      )}

      {/* Reconciliation */}
      {trip.status === "RETURNED" && canSupervise && byMaterial.size > 0 && (
        <Card className="mt-4">
          <h2 className="mb-1 font-medium">Factory reconciliation</h2>
          <p className="mb-3 text-sm text-muted">
            Scale the truck contents per material. Variance beyond ±{tolerance}% needs a reason.
          </p>
          <ReconcileForm
            tripId={trip.id}
            tolerancePct={tolerance}
            lines={[...byMaterial.entries()].map(([materialTypeId, m]) => ({
              materialTypeId,
              materialName: m.name,
              collectedKg: m.kg,
            }))}
          />
        </Card>
      )}

      {trip.reconciliation && (
        <Card className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-medium">Reconciliation</h2>
            {trip.reconciliation.approvedAt ? (
              <Badge tone="success">Approved</Badge>
            ) : (
              canSupervise &&
              trip.status === "RECONCILED" && (
                <form action={approveTrip.bind(null, trip.id)}>
                  <button type="submit" className={buttonClass}>
                    Approve &amp; create payout batch
                  </button>
                </form>
              )
            )}
          </div>
          <Table headers={["Material", "Collected", "Remitted", "Variance", "Tolerance", "Reason"]}>
            {trip.reconciliation.items.map((i) => {
              const beyond = Math.abs(Number(i.variancePct)) > Number(i.toleranceSnapshot);
              return (
                <tr key={i.id}>
                  <td className="px-3 py-2 font-medium">{i.materialType.name}</td>
                  <td className="tabular px-3 py-2">{formatKg(Number(i.collectedKg))}</td>
                  <td className="tabular px-3 py-2">{formatKg(Number(i.remittedKg))}</td>
                  <td className={`tabular px-3 py-2 font-medium ${beyond ? "text-destructive" : "text-accent"}`}>
                    {Number(i.variancePct).toFixed(1)}%
                  </td>
                  <td className="tabular px-3 py-2 text-muted">±{Number(i.toleranceSnapshot)}%</td>
                  <td className="px-3 py-2 text-muted">{i.varianceReason ?? "—"}</td>
                </tr>
              );
            })}
          </Table>
        </Card>
      )}

      {trip.payoutBatch && (
        <Card className="mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-medium">Payout batch</h2>
              <p className="text-sm text-muted">
                {trip.payoutBatch.payouts.length} vendors ·{" "}
                <span className="tabular font-medium text-foreground">
                  {formatNaira(Number(trip.payoutBatch.totalAmount))}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={statusTone(trip.payoutBatch.status)}>
                {trip.payoutBatch.status.replace(/_/g, " ")}
              </Badge>
              <Link href="/payouts" className="text-sm text-accent hover:underline">
                Open payouts →
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* Weigh-ins list */}
      <h2 className="mb-2 mt-6 font-medium">Weigh-ins ({trip.weighIns.length})</h2>
      {trip.weighIns.length === 0 ? (
        <Card>
          <p className="py-4 text-center text-sm text-muted">
            No weigh-ins recorded yet.
          </p>
        </Card>
      ) : (
        <Table headers={["Time", "Vendor", "Material", "Weight", "Amount", "Confirmed"]}>
          {trip.weighIns.map((w) => (
            <tr key={w.id}>
              <td className="tabular px-3 py-2">
                {w.createdAt.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
              </td>
              <td className="px-3 py-2">
                <Link href={`/vendors/${w.vendorId}`} className="hover:underline">
                  {w.vendor.name}
                </Link>
              </td>
              <td className="px-3 py-2">{w.materialType.name}</td>
              <td className="tabular px-3 py-2">{formatKg(Number(w.weightKg))}</td>
              <td className="tabular px-3 py-2 font-medium">{formatNaira(Number(w.amount))}</td>
              <td className="px-3 py-2">
                <Badge tone={w.confirmation === "NONE" ? "warning" : "success"}>
                  {w.confirmation === "NONE" ? "Unconfirmed" : w.confirmation.replace("_", " ")}
                </Badge>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
