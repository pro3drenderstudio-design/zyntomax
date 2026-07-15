import Link from "next/link";
import { prisma } from "@zyntomax/db";
import { requireSession, accessibleSiteIds } from "@/lib/auth";
import {
  PageHeader,
  Table,
  Badge,
  statusTone,
  PrimaryLink,
  EmptyState,
  formatKg,
} from "@/components/ui";
import { MapPin, UserPlus } from "lucide-react";

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireSession();
  const siteIds = accessibleSiteIds(session);
  const { q } = await searchParams;

  const vendors = await prisma.vendor.findMany({
    where: {
      ...(siteIds ? { siteId: { in: siteIds } } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { phone: { contains: q } },
            ],
          }
        : {}),
    },
    include: {
      locality: true,
      weighIns: { select: { weightKg: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div>
      <PageHeader
        title="Vendors"
        subtitle={`${vendors.length} registered household vendors`}
        action={
          <div className="flex gap-2">
            <Link
              href="/vendors/map"
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm font-medium hover:bg-muted-bg"
            >
              <MapPin size={15} aria-hidden /> Map view
            </Link>
            <PrimaryLink href="/vendors/new">
              <UserPlus size={15} aria-hidden /> Register vendor
            </PrimaryLink>
          </div>
        }
      />

      <form className="mb-3" action="/vendors">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by name or phone…"
          className="w-full max-w-sm rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          aria-label="Search vendors"
        />
      </form>

      {vendors.length === 0 ? (
        <EmptyState
          title="No vendors yet"
          hint="Register your first household vendor. Collection agents can also register vendors from the field app."
          action={<PrimaryLink href="/vendors/new">Register vendor</PrimaryLink>}
        />
      ) : (
        <Table headers={["Vendor", "Phone", "Locality", "Lifetime kg", "Bank", "Status"]}>
          {vendors.map((v) => {
            const lifetime = v.weighIns.reduce((s, w) => s + Number(w.weightKg), 0);
            return (
              <tr key={v.id} className="hover:bg-muted-bg">
                <td className="px-3 py-2">
                  <Link href={`/vendors/${v.id}`} className="font-medium hover:underline">
                    {v.name}
                  </Link>
                </td>
                <td className="tabular px-3 py-2">{v.phone}</td>
                <td className="px-3 py-2">{v.locality?.name ?? "—"}</td>
                <td className="tabular px-3 py-2">{formatKg(lifetime)}</td>
                <td className="px-3 py-2">
                  {v.bankVerified ? (
                    <Badge tone="success">Verified</Badge>
                  ) : (
                    <Badge tone="warning">Not verified</Badge>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Badge tone={statusTone(v.status)}>{v.status}</Badge>
                </td>
              </tr>
            );
          })}
        </Table>
      )}
    </div>
  );
}
