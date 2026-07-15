import Link from "next/link";
import { prisma } from "@zyntomax/db";
import { requireSession, accessibleSiteIds } from "@/lib/auth";
import {
  PageHeader, Table, Badge, statusTone, PrimaryLink, EmptyState, formatKg,
} from "@/components/ui";
import { Plus } from "lucide-react";

export default async function TripsPage() {
  const session = await requireSession();
  const siteIds = accessibleSiteIds(session);

  const trips = await prisma.trip.findMany({
    where: siteIds ? { siteId: { in: siteIds } } : {},
    include: {
      locality: true,
      lead: { include: { user: true } },
      weighIns: { select: { weightKg: true } },
      payoutBatch: { select: { status: true } },
    },
    orderBy: { date: "desc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader
        title="Collection trips"
        subtitle="Field collection runs — weigh-ins update live as teams work"
        action={
          <PrimaryLink href="/trips/new">
            <Plus size={15} aria-hidden /> New trip
          </PrimaryLink>
        }
      />

      {trips.length === 0 ? (
        <EmptyState
          title="No trips yet"
          hint="Create a collection trip: pick a team lead, locality and date."
          action={<PrimaryLink href="/trips/new">New trip</PrimaryLink>}
        />
      ) : (
        <Table headers={["Date", "Locality", "Team lead", "Weigh-ins", "Collected", "Status"]}>
          {trips.map((t) => (
            <tr key={t.id} className="hover:bg-muted-bg">
              <td className="px-3 py-2">
                <Link href={`/trips/${t.id}`} className="font-medium hover:underline">
                  {t.date.toLocaleDateString("en-NG")}
                </Link>
              </td>
              <td className="px-3 py-2">{t.locality?.name ?? "—"}</td>
              <td className="px-3 py-2">{t.lead.user.name}</td>
              <td className="tabular px-3 py-2">{t.weighIns.length}</td>
              <td className="tabular px-3 py-2">
                {formatKg(t.weighIns.reduce((s, w) => s + Number(w.weightKg), 0))}
              </td>
              <td className="px-3 py-2">
                <Badge tone={statusTone(t.status)}>{t.status.replace(/_/g, " ")}</Badge>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
