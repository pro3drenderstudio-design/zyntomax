import { notFound } from "next/navigation";
import { prisma } from "@zyntomax/db";
import { requireRole, accessibleSiteIds } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { listBanks } from "@/lib/paystack";
import { VendorForm } from "../../new/vendor-form";

export const metadata = { title: "Edit vendor" };

export default async function EditVendorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireRole(["OPERATIONS_MANAGER", "TEAM_LEAD"]);
  const siteIds = accessibleSiteIds(session);
  const { id } = await params;

  const [vendor, sites, localities, banks] = await Promise.all([
    prisma.vendor.findUnique({ where: { id } }),
    prisma.site.findMany({ where: { active: true, ...(siteIds ? { id: { in: siteIds } } : {}) } }),
    prisma.locality.findMany({ where: siteIds ? { siteId: { in: siteIds } } : {}, orderBy: { name: "asc" } }),
    listBanks(),
  ]);
  if (!vendor) notFound();

  return (
    <div className="max-w-xl">
      <PageHeader title={`Edit ${vendor.name}`} subtitle={vendor.vendorNo ?? undefined} />
      <VendorForm
        sites={sites.map((s) => ({ id: s.id, name: s.name }))}
        localities={localities.map((l) => ({ id: l.id, name: l.name, siteId: l.siteId }))}
        banks={banks}
        vendor={{
          id: vendor.id,
          name: vendor.name,
          nickname: vendor.nickname,
          phone: vendor.phone,
          photoUrl: vendor.photoUrl,
          address: vendor.address,
          siteId: vendor.siteId,
          localityId: vendor.localityId,
          lat: vendor.lat,
          lng: vendor.lng,
          bankName: vendor.bankName,
          bankAccountNo: vendor.bankAccountNo,
        }}
      />
    </div>
  );
}
