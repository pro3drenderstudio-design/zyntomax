import Link from "next/link";
import { prisma, type Prisma } from "@zyntomax/db";
import { requireSession, accessibleSiteIds } from "@/lib/auth";
import {
  PageHeader,
  Table,
  Badge,
  statusTone,
  PrimaryLink,
  EmptyState,
  Avatar,
  Pagination,
  formatKg,
} from "@/components/ui";
import { MapPin, UserPlus } from "lucide-react";
import { approveVendor, rejectVendor } from "./actions";

const PAGE_SIZE = 25;

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const session = await requireSession();
  const siteIds = accessibleSiteIds(session);
  const { q, status, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const where: Prisma.VendorWhereInput = {
    ...(siteIds ? { siteId: { in: siteIds } } : {}),
    ...(status && status !== "ALL" ? { status: status as never } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { nickname: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { vendorNo: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, vendors] = await Promise.all([
    prisma.vendor.count({ where }),
    prisma.vendor.findMany({
      where,
      include: { locality: true, weighIns: { select: { weightKg: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const pageCount = Math.ceil(total / PAGE_SIZE);

  const statuses = ["ALL", "PENDING", "ACTIVE", "INACTIVE", "BLACKLISTED"];

  return (
    <div>
      <PageHeader
        title="Vendors"
        subtitle={`${total} registered household vendors`}
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

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <form action="/vendors">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search name, nickname, phone or ID…"
            className="w-72 max-w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            aria-label="Search vendors"
          />
          {status && <input type="hidden" name="status" value={status} />}
        </form>
        <div className="flex gap-1">
          {statuses.map((s) => (
            <Link
              key={s}
              href={`/vendors?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                (status ?? "ALL") === s
                  ? "bg-accent-soft text-accent"
                  : "text-muted hover:bg-muted-bg"
              }`}
            >
              {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            </Link>
          ))}
        </div>
      </div>

      {vendors.length === 0 ? (
        <EmptyState
          title="No vendors found"
          hint="Register your first household vendor, or adjust the filters. Collection agents can also register vendors from the field app."
          action={<PrimaryLink href="/vendors/new">Register vendor</PrimaryLink>}
        />
      ) : (
        <>
          <Table headers={["Vendor", "ID", "Phone", "Locality", "Lifetime kg", "Bank", "Status"]}>
            {vendors.map((v) => {
              const lifetime = v.weighIns.reduce((s, w) => s + Number(w.weightKg), 0);
              return (
                <tr key={v.id} className="hover:bg-muted-bg">
                  <td className="px-3 py-2">
                    <Link href={`/vendors/${v.id}`} className="flex items-center gap-2.5 font-medium hover:underline">
                      <Avatar name={v.name} url={v.photoUrl} size={34} />
                      <span>
                        {v.name}
                        {v.nickname && <span className="ml-1 text-xs font-normal text-muted">"{v.nickname}"</span>}
                      </span>
                    </Link>
                  </td>
                  <td className="tabular px-3 py-2 text-xs text-muted">{v.vendorNo ?? "—"}</td>
                  <td className="tabular px-3 py-2">{v.phone}</td>
                  <td className="px-3 py-2">{v.locality?.name ?? "—"}</td>
                  <td className="tabular px-3 py-2">{formatKg(lifetime)}</td>
                  <td className="px-3 py-2">
                    {v.bankVerified ? <Badge tone="success">Verified</Badge> : <Badge tone="warning">Not verified</Badge>}
                  </td>
                  <td className="px-3 py-2">
                    {v.status === "PENDING" ? (
                      <div className="flex items-center gap-2">
                        <form action={approveVendor.bind(null, v.id)}>
                          <button type="submit" className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-on-primary hover:bg-accent-hover">Approve</button>
                        </form>
                        <form action={rejectVendor.bind(null, v.id)}>
                          <button type="submit" className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted-bg">Reject</button>
                        </form>
                      </div>
                    ) : (
                      <Badge tone={statusTone(v.status)}>{v.status}</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
          <Pagination basePath="/vendors" page={page} pageCount={pageCount} query={{ q, status }} />
        </>
      )}
    </div>
  );
}
