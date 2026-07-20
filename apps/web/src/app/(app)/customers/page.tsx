import { prisma } from "@zyntomax/db";
import { requireSession, hasRole } from "@/lib/auth";
import { PageHeader, Card, Table, formatNaira, formatKg } from "@/components/ui";
import { CustomerForm, PriceForm } from "./customer-forms";

export default async function CustomersPage() {
  const session = await requireSession();
  const canEdit = hasRole(session, ["SALES_ADMIN", "FINANCE_ADMIN", "OPERATIONS_MANAGER"]);

  const [customers, products] = await Promise.all([
    prisma.customer.findMany({
      include: {
        orders: {
          include: {
            items: true,
            invoice: { include: { payments: true } },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.materialType.findMany({
      where: { active: true, OR: [{ kind: "FINISHED" }, { sellable: true }] },
      include: {
        priceLists: {
          where: { customerId: null },
          orderBy: { effectiveFrom: "desc" },
          take: 1,
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div>
      <PageHeader title="Customers & pricing" subtitle="Offtakers buying finished goods" />

      {canEdit && (
        <Card className="mb-4">
          <h2 className="mb-3 font-medium">Add customer</h2>
          <CustomerForm />
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Table headers={["Customer", "Contact", "Terms", "Sales", "Lifetime value", "Sold (kg)", "Last sale", "Open balance"]}>
            {customers.map((c) => {
              const invoices = c.orders.flatMap((o) => (o.invoice ? [o.invoice] : []));
              const owed = invoices.reduce(
                (s, inv) => s + Number(inv.amount) - inv.payments.reduce((x, p) => x + Number(p.amount), 0),
                0,
              );
              const lifetime = c.orders.reduce(
                (s, o) => s + o.items.reduce((x, i) => x + Number(i.qtyKg) * Number(i.unitPrice), 0),
                0,
              );
              const soldKg = c.orders.reduce(
                (s, o) => s + o.items.filter((i) => i.isInventory).reduce((x, i) => x + Number(i.qtyKg), 0),
                0,
              );
              const lastSale = c.orders.reduce<Date | null>(
                (latest, o) => (!latest || o.createdAt > latest ? o.createdAt : latest),
                null,
              );
              return (
                <tr key={c.id} className="hover:bg-muted-bg">
                  <td className="px-3 py-2 font-medium">{c.name}</td>
                  <td className="px-3 py-2 text-muted">
                    {c.contactName ?? "—"}{c.phone ? ` · ${c.phone}` : ""}
                  </td>
                  <td className="px-3 py-2">
                    {c.creditTermsDays === 0 ? "On sale" : `${c.creditTermsDays} days`}
                  </td>
                  <td className="tabular px-3 py-2">{c.orders.length}</td>
                  <td className="tabular px-3 py-2">{formatNaira(lifetime)}</td>
                  <td className="tabular px-3 py-2">{formatKg(soldKg)}</td>
                  <td className="px-3 py-2 text-muted">{lastSale ? lastSale.toLocaleDateString("en-NG") : "—"}</td>
                  <td className={`tabular px-3 py-2 font-medium ${owed > 0 ? "text-warning" : ""}`}>
                    {formatNaira(owed)}
                  </td>
                </tr>
              );
            })}
          </Table>
        </div>

        <Card>
          <h2 className="mb-3 font-medium">List prices</h2>
          <ul className="mb-4 flex flex-col gap-1.5">
            {products.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <span>{p.name}</span>
                <span className="tabular font-medium">
                  {p.priceLists[0] ? `${formatNaira(Number(p.priceLists[0].pricePerKg))}/kg` : "No price"}
                </span>
              </li>
            ))}
          </ul>
          {canEdit && (
            <PriceForm products={products.map((p) => ({ id: p.id, name: p.name }))} />
          )}
        </Card>
      </div>
    </div>
  );
}
