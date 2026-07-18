import Link from "next/link";
import { prisma } from "@zyntomax/db";
import { requireSession, accessibleSiteIds, hasRole } from "@/lib/auth";
import {
  PageHeader, Card, Table, Badge, statusTone, formatKg, formatNaira,
} from "@/components/ui";
import { SaleForm } from "./order-forms";

export default async function SalesPage() {
  const session = await requireSession();
  const siteIds = accessibleSiteIds(session);
  const canCreate = hasRole(session, ["SALES_ADMIN", "OPERATIONS_MANAGER"]);

  const [orders, customers, sites, products] = await Promise.all([
    prisma.salesOrder.findMany({
      where: siteIds ? { siteId: { in: siteIds } } : {},
      include: {
        customer: true,
        items: { include: { product: true } },
        invoice: { include: { payments: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
    prisma.site.findMany({ where: { active: true, ...(siteIds ? { id: { in: siteIds } } : {}) } }),
    prisma.product.findMany({
      where: { active: true },
      include: { priceLists: { where: { customerId: null }, orderBy: { effectiveFrom: "desc" }, take: 1 } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader title="Sales" subtitle="Record a sale — finished-goods lines deduct stock; non-inventory lines are pure revenue" />

      {canCreate && (
        <Card className="mb-4">
          <h2 className="mb-3 font-medium">Record a sale</h2>
          <SaleForm
            customers={customers.map((c) => ({ id: c.id, name: c.name }))}
            sites={sites.map((s) => ({ id: s.id, name: s.name }))}
            products={products.map((p) => ({
              id: p.id,
              name: p.name,
              price: p.priceLists[0] ? Number(p.priceLists[0].pricePerKg) : 0,
            }))}
          />
        </Card>
      )}

      <Table headers={["Sale", "Date", "Customer", "Items", "Total", "Invoice", "Status"]}>
        {orders.map((o) => {
          const total = o.items.reduce((s, i) => s + Number(i.qtyKg) * Number(i.unitPrice), 0);
          const inv = o.invoice;
          const paid = inv?.payments.reduce((s, p) => s + Number(p.amount), 0) ?? 0;
          const invStatus = inv
            ? paid >= Number(inv.amount) ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID"
            : "—";
          return (
            <tr key={o.id} className="hover:bg-muted-bg">
              <td className="px-3 py-2">
                <Link href={`/orders/${o.id}`} className="tabular font-medium hover:underline">{o.orderNo}</Link>
              </td>
              <td className="px-3 py-2">{o.createdAt.toLocaleDateString("en-NG")}</td>
              <td className="px-3 py-2">{o.customer.name}</td>
              <td className="px-3 py-2 text-sm text-muted">
                {o.items.map((i) => i.isInventory ? i.product?.name : i.description).filter(Boolean).slice(0, 2).join(", ")}
                {o.items.length > 2 ? "…" : ""}
              </td>
              <td className="tabular px-3 py-2 font-medium">{formatNaira(total)}</td>
              <td className="tabular px-3 py-2 text-xs">{inv?.invoiceNo ?? "—"}</td>
              <td className="px-3 py-2"><Badge tone={statusTone(invStatus)}>{invStatus}</Badge></td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}
