import { prisma } from "@zyntomax/db";
import { requireSession, accessibleSiteIds } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { NIGERIAN_BANKS } from "@/lib/paystack";
import { VendorForm } from "./vendor-form";

export const metadata = { title: "Register vendor" };

export default async function NewVendorPage() {
  const session = await requireSession();
  const siteIds = accessibleSiteIds(session);

  const [sites, localities] = await Promise.all([
    prisma.site.findMany({
      where: { active: true, ...(siteIds ? { id: { in: siteIds } } : {}) },
    }),
    prisma.locality.findMany({
      where: siteIds ? { siteId: { in: siteIds } } : {},
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="max-w-xl">
      <PageHeader
        title="Register vendor"
        subtitle="Capture the vendor at their house so the pinned location is accurate."
      />
      <VendorForm
        sites={sites.map((s) => ({ id: s.id, name: s.name }))}
        localities={localities.map((l) => ({ id: l.id, name: l.name, siteId: l.siteId }))}
        banks={NIGERIAN_BANKS}
      />
    </div>
  );
}
