import Link from "next/link";
import { prisma } from "@zyntomax/db";
import { requireSession, accessibleSiteIds, hasRole } from "@/lib/auth";
import { PageHeader, Card, StatCard, Table, Badge, Avatar, Pagination, formatKg } from "@/components/ui";
import { PickupActions } from "./pickup-actions";
import { PickupMap, type PickupPin } from "./pickup-map";
import { startOfWeek } from "date-fns";

const STATUSES = ["ALL", "PENDING", "SCHEDULED", "COLLECTED", "CANCELLED"] as const;
const TONE: Record<string, "warning" | "info" | "success" | "destructive" | "neutral"> = {
  PENDING: "warning", SCHEDULED: "info", COLLECTED: "success", CANCELLED: "destructive",
};
const PER_PAGE = 25;

export default async function PickupsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; view?: string; page?: string }>;
}) {
  const session = await requireSession();
  const siteIds = accessibleSiteIds(session);
  const canManage = hasRole(session, ["OPERATIONS_MANAGER", "FACTORY_SUPERVISOR", "TEAM_LEAD"]);
  const { status = "PENDING", view = "list", page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const vendorSite = siteIds ? { vendor: { siteId: { in: siteIds } } } : {};
  const statusWhere = status !== "ALL" ? { status: status as never } : {};
  const where = { ...vendorSite, ...statusWhere };

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });

  const [counts, collectedWeek, total, pickups, activeTrips] = await Promise.all([
    prisma.pickupRequest.groupBy({ by: ["status"], where: vendorSite, _count: true }),
    prisma.pickupRequest.count({ where: { ...vendorSite, status: "COLLECTED", createdAt: { gte: weekStart } } }),
    prisma.pickupRequest.count({ where }),
    prisma.pickupRequest.findMany({
      where,
      include: {
        vendor: { include: { locality: true } },
        trip: { include: { lead: { include: { user: true } }, locality: true } },
      },
      orderBy: { createdAt: "desc" },
      take: PER_PAGE,
      skip: (page - 1) * PER_PAGE,
    }),
    prisma.trip.findMany({
      where: { status: { in: ["PLANNED", "IN_PROGRESS"] }, ...(siteIds ? { siteId: { in: siteIds } } : {}) },
      include: { locality: true, lead: { include: { user: true } } },
      orderBy: { date: "desc" },
      take: 40,
    }),
  ]);

  const countOf = (s: string) => counts.find((c) => c.status === s)?._count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));

  const tripOpts = activeTrips.map((tr) => ({
    id: tr.id,
    localityId: tr.localityId,
    label: `${tr.date.toLocaleDateString("en-NG", { day: "numeric", month: "short" })} · ${tr.locality?.name ?? "Route"} · ${tr.lead?.user.name ?? "Lead"}`,
  }));

  // Map pins (only requests with coordinates)
  let pins: PickupPin[] = [];
  if (view === "map") {
    const mapStatus = status !== "ALL" ? { status: status as never } : { status: { in: ["PENDING", "SCHEDULED"] as never } };
    const withCoords = await prisma.pickupRequest.findMany({
      where: { ...vendorSite, ...mapStatus, lat: { not: null }, lng: { not: null } },
      include: { vendor: true },
      take: 500,
    });
    pins = withCoords.map((p) => ({
      id: p.id, vendor: p.vendor.name, lat: p.lat!, lng: p.lng!, status: p.status,
      weight: p.estWeightKg ? `~${formatKg(Number(p.estWeightKg))}` : "weight TBD",
    }));
  }

  const linkFor = (params: Record<string, string>) => {
    const sp = new URLSearchParams({ status, view, ...params });
    return `/pickups?${sp.toString()}`;
  };

  return (
    <div>
      <PageHeader title="Pickup requests" subtitle="On-demand collection requests from vendors — dispatch them to a trip" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Pending" value={String(countOf("PENDING"))} tone={countOf("PENDING") > 0 ? "warning" : "default"} />
        <StatCard label="Scheduled" value={String(countOf("SCHEDULED"))} tone="accent" />
        <StatCard label="Collected this week" value={String(collectedWeek)} />
        <StatCard label="Cancelled" value={String(countOf("CANCELLED"))} />
      </div>

      {/* Filters + view toggle */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => (
            <Link
              key={s}
              href={`/pickups?status=${s}&view=${view}`}
              className={`rounded-md px-3 py-1.5 text-sm ${status === s ? "bg-accent text-on-primary" : "border border-border hover:bg-muted-bg"}`}
            >
              {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
              {s !== "ALL" && s !== "COLLECTED" ? ` (${countOf(s)})` : ""}
            </Link>
          ))}
        </div>
        <div className="flex gap-1.5">
          <Link href={`/pickups?status=${status}&view=list`} className={`rounded-md px-3 py-1.5 text-sm ${view === "list" ? "bg-accent text-on-primary" : "border border-border hover:bg-muted-bg"}`}>List</Link>
          <Link href={`/pickups?status=${status}&view=map`} className={`rounded-md px-3 py-1.5 text-sm ${view === "map" ? "bg-accent text-on-primary" : "border border-border hover:bg-muted-bg"}`}>Map</Link>
        </div>
      </div>

      {view === "map" ? (
        <div className="mt-4">
          {pins.length === 0 ? (
            <Card><p className="py-8 text-center text-sm text-muted">No pickup requests with a pinned location to show.</p></Card>
          ) : (
            <PickupMap pins={pins} />
          )}
        </div>
      ) : (
        <div className="mt-4">
          <Table headers={["Vendor", "Load", "Est. weight", "Locality", "Source", "Status", "Trip", "Requested", canManage ? "Action" : ""]}>
            {pickups.map((p) => {
              const trips = tripOpts
                .map((tr) => ({ id: tr.id, label: tr.label, sameLocality: tr.localityId != null && tr.localityId === p.vendor.localityId }))
                .sort((a, b) => Number(b.sameLocality) - Number(a.sameLocality));
              return (
                <tr key={p.id} className="hover:bg-muted-bg">
                  <td className="px-3 py-2">
                    <Link href={`/pickups/${p.id}`} className="flex items-center gap-2.5 font-medium hover:underline">
                      <Avatar name={p.vendor.name} url={p.vendor.photoUrl} size={30} />
                      <span>
                        {p.vendor.name}
                        <span className="block text-xs font-normal text-muted">{p.vendor.phone}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {p.photoUrl ? (
                      <Link href={`/pickups/${p.id}`}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.photoUrl} alt="Recyclables" className="h-11 w-11 rounded-md object-cover" />
                      </Link>
                    ) : (
                      <span className="text-xs text-muted">No photo</span>
                    )}
                  </td>
                  <td className="tabular px-3 py-2">{p.estWeightKg ? formatKg(Number(p.estWeightKg)) : "—"}</td>
                  <td className="px-3 py-2">{p.vendor.locality?.name ?? "—"}</td>
                  <td className="px-3 py-2 text-xs text-muted">{p.source}</td>
                  <td className="px-3 py-2"><Badge tone={TONE[p.status] ?? "neutral"}>{p.status}</Badge></td>
                  <td className="px-3 py-2 text-sm">
                    {p.trip ? (
                      <Link href={`/trips/${p.tripId}`} className="text-accent hover:underline">
                        {p.trip.locality?.name ?? "Trip"} · {p.trip.date.toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                      </Link>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2 text-xs text-muted">{p.createdAt.toLocaleDateString("en-NG")}</td>
                  {canManage ? <td className="px-3 py-2"><PickupActions pickupId={p.id} status={p.status} trips={trips} /></td> : <td />}
                </tr>
              );
            })}
            {pickups.length === 0 && (
              <tr><td colSpan={9} className="px-3 py-8 text-center text-sm text-muted">No {status !== "ALL" ? status.toLowerCase() : ""} pickup requests.</td></tr>
            )}
          </Table>
          <Pagination basePath="/pickups" page={page} pageCount={pageCount} query={{ status, view }} />
        </div>
      )}
    </div>
  );
}
