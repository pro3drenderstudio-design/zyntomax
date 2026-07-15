import Link from "next/link";
import { prisma } from "@zyntomax/db";
import { requireSession, accessibleSiteIds, hasRole } from "@/lib/auth";
import {
  PageHeader, Card, Table, Badge, statusTone, formatKg, formatNaira,
} from "@/components/ui";
import { OrderForm } from "./order-forms";

export default async function OrdersPage() {
  const session = await requireSession();
  const siteIds = accessibleSiteIds(session);
  const canCreate = hasRole(session, ["SALES_ADMIN", "OPERATIONS_MANAGER"]);

  const [orders, customers, sites, products] = await Promise.all([
    prisma.salesOrder.findMany({
      where: siteIds ? { siteId: { in: siteIds } } : {},
      include: {
        customer: true,
        items: { include: { product: true } },
        dispatches: { include: { items: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    prisma.site.findMany({ where: { active: true, ...(siteIds ? { id: { in: siteIds } } : {}) } }),
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader title="Sales orders" subtitle="Confirmed orders reserve finished goods for dispatch" />

      {canCreate && (
        <Card className="mb-4">
          <h2 className="mb-3 font-medium">New sales order</h2>
          <OrderForm
            customers={customers.map((c) => ({ id: c.id, name: c.name }))}
            sites={sites.map((s) => ({ id: s.id, name: s.name }))}
            products={products.map((p) => ({ id: p.id, name: p.name }))}
          />
        </Card>
      )}

      <Table headers={["Order", "Customer", "Ordered", "Dispatched", "Value", "Status"]}>
        {orders.map((o) => {
          const orderedKg = o.items.reduce((s, i) => s + Number(i.qtyKg), 0);
          const dispatchedKg = o.dispatches.flatMap((d) => d.items).reduce((s, i) => s + Number(i.weightKg), 0);
          const value = o.items.reduce((s, i) => s + Number(i.qtyKg) * Number(i.unitPrice), 0);
          return (
            <tr key={o.id} className="hover:bg-muted-bg">
              <td className="px-3 py-2">
                <Link href={`/orders/${o.id}`} className="tabular font-medium hover:underline">
                  {o.orderNo}
                </Link>
              </td>
              <td className="px-3 py-2">{o.customer.name}</td>
              <td className="tabular px-3 py-2">{formatKg(orderedKg)}</td>
              <td className="tabular px-3 py-2">{formatKg(dispatchedKg)}</td>
              <td className="tabular px-3 py-2">{formatNaira(value)}</td>
              <td className="px-3 py-2">
                <Badge tone={statusTone(o.status)}>{o.status.replace(/_/g, " ")}</Badge>
              </td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}
