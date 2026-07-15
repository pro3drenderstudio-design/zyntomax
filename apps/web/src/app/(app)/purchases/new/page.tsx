import { prisma } from "@zyntomax/db";
import { requireRole, accessibleSiteIds } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { PurchaseForm } from "./purchase-form";

export const metadata = { title: "New purchase batch" };

export default async function NewPurchasePage() {
  const session = await requireRole([
    "PURCHASING_MANAGER",
    "FACTORY_SUPERVISOR",
    "OPERATIONS_MANAGER",
  ]);
  const siteIds = accessibleSiteIds(session);

  const [sites, suppliers] = await Promise.all([
    prisma.site.findMany({
      where: { active: true, ...(siteIds ? { id: { in: siteIds } } : {}) },
    }),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-lg">
      <PageHeader
        title="New purchase batch"
        subtitle="Created by the purchasing manager in the field; scaled in on arrival at the factory."
      />
      <PurchaseForm
        sites={sites.map((s) => ({ id: s.id, name: s.name }))}
        suppliers={suppliers.map((s) => ({ id: s.id, name: s.name }))}
      />
    </div>
  );
}
