import { prisma } from "@zyntomax/db";
import { requireSession, hasRole } from "@/lib/auth";
import { PageHeader, Card, Table, formatNaira, formatKg } from "@/components/ui";
import { BudgetForm, TargetForm } from "./budget-forms";
import { startOfMonth, endOfMonth } from "date-fns";

export default async function BudgetsPage() {
  const session = await requireSession();
  const canEdit = hasRole(session, ["FINANCE_ADMIN", "OPERATIONS_MANAGER"]);

  const now = new Date();
  const [budgets, targets, categories, monthExpenses] = await Promise.all([
    prisma.budget.findMany({
      where: { periodYear: now.getFullYear(), periodMonth: now.getMonth() + 1 },
      include: { category: true },
    }),
    prisma.target.findMany({
      where: { periodYear: now.getFullYear(), periodMonth: now.getMonth() + 1 },
      include: { materialType: true },
    }),
    prisma.expenseCategory.findMany({ orderBy: { name: "asc" } }),
    prisma.expense.groupBy({
      by: ["categoryId"],
      _sum: { amount: true },
      where: { incurredAt: { gte: startOfMonth(now), lte: endOfMonth(now) } },
    }),
  ]);

  const actualByCategory = new Map(
    monthExpenses.map((e) => [e.categoryId, Number(e._sum.amount ?? 0)]),
  );

  return (
    <div>
      <PageHeader
        title="Budgets & targets"
        subtitle={now.toLocaleDateString("en-NG", { month: "long", year: "numeric" })}
      />

      {canEdit && (
        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="mb-3 font-medium">Set a category budget</h2>
            <BudgetForm categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
          </Card>
          <Card>
            <h2 className="mb-3 font-medium">Set a monthly target</h2>
            <TargetForm />
          </Card>
        </div>
      )}

      <h2 className="mb-2 font-medium">Budget vs actual — this month</h2>
      <Table headers={["Category", "Budget", "Actual", "Remaining", "Used"]}>
        {budgets.map((b) => {
          const actual = actualByCategory.get(b.categoryId) ?? 0;
          const remaining = Number(b.amount) - actual;
          const pct = Number(b.amount) > 0 ? (actual / Number(b.amount)) * 100 : 0;
          return (
            <tr key={b.id}>
              <td className="px-3 py-2 font-medium">{b.category.name}</td>
              <td className="tabular px-3 py-2">{formatNaira(Number(b.amount))}</td>
              <td className="tabular px-3 py-2">{formatNaira(actual)}</td>
              <td className={`tabular px-3 py-2 ${remaining < 0 ? "text-destructive font-medium" : ""}`}>
                {formatNaira(remaining)}
              </td>
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-muted-bg">
                    <div
                      className={`h-full rounded-full ${pct > 100 ? "bg-destructive" : pct > 80 ? "bg-warning" : "bg-accent"}`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                  <span className="tabular text-xs text-muted">{pct.toFixed(0)}%</span>
                </div>
              </td>
            </tr>
          );
        })}
        {budgets.length === 0 && (
          <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-muted">No budgets set for this month.</td></tr>
        )}
      </Table>

      <h2 className="mb-2 mt-6 font-medium">Targets — this month</h2>
      <Table headers={["Metric", "Scope", "Target"]}>
        {targets.map((t) => (
          <tr key={t.id}>
            <td className="px-3 py-2 font-medium">{t.metric.replace(/_/g, " ")}</td>
            <td className="px-3 py-2">{t.materialType?.name ?? "All materials"}</td>
            <td className="tabular px-3 py-2">
              {t.metric === "SALES_NAIRA" ? formatNaira(Number(t.value)) : formatKg(Number(t.value))}
            </td>
          </tr>
        ))}
        {targets.length === 0 && (
          <tr><td colSpan={3} className="px-3 py-6 text-center text-sm text-muted">No targets set for this month.</td></tr>
        )}
      </Table>
    </div>
  );
}
