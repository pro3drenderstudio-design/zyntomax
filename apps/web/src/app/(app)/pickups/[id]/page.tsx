import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@zyntomax/db";
import { requireSession, accessibleSiteIds, hasRole } from "@/lib/auth";
import { PageHeader, Card, Badge, Avatar, formatKg } from "@/components/ui";
import { PickupActions } from "../pickup-actions";
import { PickupMap } from "../pickup-map";

const TONE: Record<string, "warning" | "info" | "success" | "destructive" | "neutral"> = {
  PENDING: "warning", SCHEDULED: "info", COLLECTED: "success", CANCELLED: "destructive",
};
const STEPS = [
  { key: "PENDING", label: "Requested" },
  { key: "SCHEDULED", label: "Scheduled" },
  { key: "COLLECTED", label: "Collected" },
];

export default async function PickupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession();
  const siteIds = accessibleSiteIds(session);
  const canManage = hasRole(session, ["OPERATIONS_MANAGER", "FACTORY_SUPERVISOR", "TEAM_LEAD"]);
  const { id } = await params;

  const p = await prisma.pickupRequest.findUnique({
    where: { id },
    include: {
      vendor: { include: { locality: true } },
      trip: { include: { lead: { include: { user: true } }, locality: true } },
    },
  });
  if (!p) notFound();

  const activeTrips = canManage && p.status === "PENDING"
    ? await prisma.trip.findMany({
        where: { status: { in: ["PLANNED", "IN_PROGRESS"] }, ...(siteIds ? { siteId: { in: siteIds } } : {}) },
        include: { locality: true, lead: { include: { user: true } } },
        orderBy: { date: "desc" }, take: 40,
      })
    : [];
  const trips = activeTrips
    .map((tr) => ({ id: tr.id, label: `${tr.date.toLocaleDateString("en-NG", { day: "numeric", month: "short" })} · ${tr.locality?.name ?? "Route"} · ${tr.lead?.user.name ?? "Lead"}`, sameLocality: tr.localityId != null && tr.localityId === p.vendor.localityId }))
    .sort((a, b) => Number(b.sameLocality) - Number(a.sameLocality));

  const cancelled = p.status === "CANCELLED";
  const currentIdx = STEPS.findIndex((s) => s.key === p.status);

  return (
    <div>
      <PageHeader title="Pickup request" subtitle={`${p.vendor.name} · ${p.createdAt.toLocaleString("en-NG")}`} />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: photo + map */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-medium">Recyclables</h2>
              <Badge tone={TONE[p.status] ?? "neutral"}>{p.status}</Badge>
            </div>
            {p.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.photoUrl} alt="Recyclables" className="max-h-[420px] w-full rounded-md object-contain" />
            ) : (
              <p className="py-8 text-center text-sm text-muted">No photo was attached to this request.</p>
            )}
            {p.note && <p className="mt-3 text-sm text-muted">“{p.note}”</p>}
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div><span className="block text-xs text-muted">Est. weight</span>{p.estWeightKg ? formatKg(Number(p.estWeightKg)) : "To be measured"}</div>
              <div><span className="block text-xs text-muted">Source</span>{p.source}</div>
              <div><span className="block text-xs text-muted">Requested</span>{p.createdAt.toLocaleDateString("en-NG")}</div>
            </div>
          </Card>

          {p.lat != null && p.lng != null && (
            <Card>
              <h2 className="mb-3 font-medium">Location</h2>
              <PickupMap pins={[{ id: p.id, vendor: p.vendor.name, lat: p.lat, lng: p.lng, status: p.status, weight: p.estWeightKg ? `~${formatKg(Number(p.estWeightKg))}` : "weight TBD" }]} />
            </Card>
          )}
        </div>

        {/* Right: vendor + timeline + actions */}
        <div className="space-y-4">
          <Card>
            <Link href={`/vendors/${p.vendorId}`} className="flex items-center gap-3 hover:underline">
              <Avatar name={p.vendor.name} url={p.vendor.photoUrl} size={48} />
              <div>
                <p className="font-medium">{p.vendor.name}</p>
                <p className="text-sm text-muted">{p.vendor.phone}</p>
                <p className="text-xs text-muted">{p.vendor.locality?.name ?? "No locality"}</p>
              </div>
            </Link>
          </Card>

          {canManage && (p.status === "PENDING" || p.status === "SCHEDULED") && (
            <Card>
              <h2 className="mb-3 font-medium">Actions</h2>
              <PickupActions pickupId={p.id} status={p.status} trips={trips} compact={false} />
            </Card>
          )}

          <Card>
            <h2 className="mb-3 font-medium">Status</h2>
            {cancelled ? (
              <p className="text-sm font-medium text-destructive">This request was cancelled.</p>
            ) : (
              <ol className="space-y-3">
                {STEPS.map((step, i) => {
                  const done = i <= currentIdx;
                  return (
                    <li key={step.key} className="flex items-center gap-3">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-accent text-on-primary" : "bg-muted-bg text-muted"}`}>{i + 1}</span>
                      <span className={done ? "font-medium" : "text-muted"}>{step.label}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>

          {p.trip && (
            <Card>
              <h2 className="mb-2 font-medium">Assigned trip</h2>
              <Link href={`/trips/${p.tripId}`} className="text-sm text-accent hover:underline">
                {p.trip.locality?.name ?? "Trip"} · {p.trip.date.toLocaleDateString("en-NG")}
              </Link>
              <p className="mt-1 text-sm text-muted">Collector: {p.trip.lead?.user.name ?? "—"}{p.trip.vehicle ? ` · ${p.trip.vehicle}` : ""}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
