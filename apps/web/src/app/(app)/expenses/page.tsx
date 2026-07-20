import Link from "next/link";
import { prisma } from "@zyntomax/db";
import { requireSession, accessibleSiteIds, hasRole } from "@/lib/auth";
import { PageHeader, Card, Table, formatNaira, StatCard } from "@/components/ui";
import { ExpenseForm } from "./expense-form";
import { startOfMonth } from "date-fns";

export default async function ExpensesPage() {
  const session = await requireSession();
  const siteIds = accessibleSiteIds(session);
  const canEdit = hasRole(session, ["FINANCE_ADMIN", "OPERATIONS_MANAGER"]);

  const [expenses, categories, sites, batches, trips, sales] = await Promise.all([
    prisma.expense.findMany({
      where: siteIds ? { siteId: { in: siteIds } } : {},
      include: { category: true, purchaseBatch: true, trip: { include: { locality: true } }, salesOrder: { include: { customer: true } } },
      orderBy: { incurredAt: "desc" },
      take: 100,
    }),
    prisma.expenseCategory.findMany({ orderBy: { name: "asc" } }),
    prisma.site.findMany({ where: { active: true, ...(siteIds ? { id: { in: siteIds } } : {}) } }),
    prisma.purchaseBatch.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { supplier: true },
    }),
    prisma.trip.findMany({
      orderBy: { date: "desc" },
      take: 30,
      include: { locality: true },
    }),
    prisma.salesOrder.findMany({
      where: siteIds ? { siteId: { in: siteIds } } : {},
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { customer: true },
    }),
  ]);

  const monthStart = startOfMonth(new Date());
  const monthTotal = expenses
    .filter((e) => e.incurredAt >= monthStart)
    .reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div>
      <PageHeader title="Expenses" subtitle="Every cost, optionally tied to the batch or trip that caused it" />

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="This month" value={formatNaira(monthTotal)} />
      </div>

      {canEdit && (
        <Card className="mb-4">
          <h2 className="mb-3 font-medium">Record expense</h2>
          <ExpenseForm
            sites={sites.map((s) => ({ id: s.id, name: s.name }))}
            categories={categories.map((c) => ({ id: c.id, name: c.name }))}
            batches={batches.map((b) => ({ id: b.id, name: `${b.lotNo} — ${b.supplier.name}` }))}
            trips={trips.map((t) => ({
              id: t.id,
              name: `${t.date.toLocaleDateString("en-NG")} — ${t.locality?.name ?? "Route"}`,
            }))}
            sales={sales.map((s) => ({ id: s.id, name: `${s.orderNo} — ${s.customer.name}` }))}
          />
        </Card>
      )}

      <Table headers={["Date", "Category", "Description", "Tied to", "Amount"]}>
        {expenses.map((e) => (
          <tr key={e.id}>
            <td className="px-3 py-2">{e.incurredAt.toLocaleDateString("en-NG")}</td>
            <td className="px-3 py-2">{e.category.name}</td>
            <td className="px-3 py-2 text-muted">{e.description ?? "—"}</td>
            <td className="px-3 py-2">
              {e.purchaseBatch ? (
                <Link href={`/purchases/${e.purchaseBatchId}`} className="tabular text-accent hover:underline">
                  {e.purchaseBatch.lotNo}
                </Link>
              ) : e.trip ? (
                <Link href={`/trips/${e.tripId}`} className="text-accent hover:underline">
                  Trip {e.trip.date.toLocaleDateString("en-NG")}
                </Link>
              ) : e.salesOrder ? (
                <Link href={`/orders/${e.salesOrderId}`} className="text-accent hover:underline">
                  {e.salesOrder.orderNo} · {e.salesOrder.customer.name}
                </Link>
              ) : (
                "—"
              )}
            </td>
            <td className="tabular px-3 py-2 font-medium">{formatNaira(Number(e.amount))}</td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
