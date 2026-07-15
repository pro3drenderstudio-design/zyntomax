import { prisma } from "@zyntomax/db";
import { requireRole, accessibleSiteIds } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { TripForm } from "./trip-form";

export const metadata = { title: "New trip" };

export default async function NewTripPage() {
  const session = await requireRole(["OPERATIONS_MANAGER", "TEAM_LEAD"]);
  const siteIds = accessibleSiteIds(session);

  const [sites, localities, staff] = await Promise.all([
    prisma.site.findMany({
      where: { active: true, ...(siteIds ? { id: { in: siteIds } } : {}) },
    }),
    prisma.locality.findMany({
      where: siteIds ? { siteId: { in: siteIds } } : {},
      orderBy: { name: "asc" },
    }),
    prisma.staffProfile.findMany({
      where: {
        user: {
          status: "ACTIVE",
          roles: { some: { role: { in: ["TEAM_LEAD", "COLLECTION_AGENT"] } } },
        },
      },
      include: { user: { include: { roles: true } } },
    }),
  ]);

  return (
    <div className="max-w-xl">
      <PageHeader title="New collection trip" />
      <TripForm
        sites={sites.map((s) => ({ id: s.id, name: s.name }))}
        localities={localities.map((l) => ({ id: l.id, name: l.name, siteId: l.siteId }))}
        leads={staff
          .filter((s) => s.user.roles.some((r) => r.role === "TEAM_LEAD"))
          .map((s) => ({ id: s.id, name: s.user.name }))}
        agents={staff.map((s) => ({ id: s.id, name: s.user.name }))}
      />
    </div>
  );
}
