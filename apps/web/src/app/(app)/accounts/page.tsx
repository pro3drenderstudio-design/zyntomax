import { prisma } from "@zyntomax/db";
import { requireSession, accessibleSiteIds, hasRole } from "@/lib/auth";
import { PageHeader, Card, StatCard, Table, Badge, formatNaira } from "@/components/ui";
import { CreateAccountForm, FundForm, SpendForm } from "./account-forms";

export default async function AccountsPage() {
  const session = await requireSession();
  const siteIds = accessibleSiteIds(session);
  const canManage = hasRole(session, ["FINANCE_ADMIN", "OPERATIONS_MANAGER"]);

  const [accounts, sites, categories] = await Promise.all([
    prisma.cashAccount.findMany({
      where: { active: true, ...(siteIds ? { siteId: { in: siteIds } } : {}) },
      include: {
        site: true,
        transactions: { orderBy: { createdAt: "desc" }, take: 8, include: { expense: { include: { category: true } } } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.site.findMany({ where: { active: true, ...(siteIds ? { id: { in: siteIds } } : {}) } }),
    prisma.expenseCategory.findMany({ orderBy: { name: "asc" } }),
  ]);

  // Balances + totals per account (all-time)
  const totals = await prisma.cashTransaction.groupBy({
    by: ["accountId", "kind"],
    _sum: { amount: true },
  });
  const balanceOf = (id: string) =>
    totals.filter((t) => t.accountId === id).reduce((s, t) => s + Number(t._sum.amount ?? 0), 0);
  const fundedOf = (id: string) =>
    totals.filter((t) => t.accountId === id && t.kind === "FUNDING").reduce((s, t) => s + Number(t._sum.amount ?? 0), 0);
  const spentOf = (id: string) =>
    -totals.filter((t) => t.accountId === id && t.kind === "EXPENSE").reduce((s, t) => s + Number(t._sum.amount ?? 0), 0);

  const catOptions = categories.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div>
      <PageHeader
        title="Cash accounts"
        subtitle="Funded floats a manager spends from — every spend is a categorised expense, so the books stay clean"
      />

      {canManage && (
        <Card className="mb-4">
          <h2 className="mb-3 font-medium">Create an account</h2>
          <CreateAccountForm sites={sites.map((s) => ({ id: s.id, name: s.name }))} />
        </Card>
      )}

      {accounts.length === 0 && (
        <Card><p className="py-4 text-center text-sm text-muted">No cash accounts yet.</p></Card>
      )}

      <div className="flex flex-col gap-4">
        {accounts.map((acc) => {
          const balance = balanceOf(acc.id);
          return (
            <Card key={acc.id}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-medium">{acc.name}</h2>
                  <p className="text-xs text-muted">{acc.site?.name ?? "—"}</p>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-3 gap-3">
                <StatCard label="Balance" value={formatNaira(balance)} tone={balance <= 0 ? "destructive" : "accent"} />
                <StatCard label="Total funded" value={formatNaira(fundedOf(acc.id))} />
                <StatCard label="Total spent" value={formatNaira(spentOf(acc.id))} />
              </div>

              {canManage && (
                <div className="mb-4 flex flex-col gap-3 rounded-md border border-border p-3">
                  <FundForm accountId={acc.id} />
                  <SpendForm accountId={acc.id} categories={catOptions} />
                </div>
              )}

              <h3 className="mb-1 text-sm font-medium">Recent activity</h3>
              <Table headers={["Date", "Type", "Detail", "Amount"]}>
                {acc.transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="px-3 py-2">{t.createdAt.toLocaleDateString("en-NG")}</td>
                    <td className="px-3 py-2">
                      <Badge tone={t.kind === "FUNDING" ? "success" : t.kind === "EXPENSE" ? "neutral" : "info"}>
                        {t.kind === "FUNDING" ? "Funding" : t.kind === "EXPENSE" ? "Spend" : "Adjustment"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-muted">
                      {t.expense?.category ? `${t.expense.category.name}${t.note ? ` · ${t.note}` : ""}` : (t.note ?? "—")}
                    </td>
                    <td className={`tabular px-3 py-2 font-medium ${Number(t.amount) < 0 ? "text-destructive" : "text-accent"}`}>
                      {Number(t.amount) < 0 ? "−" : "+"}{formatNaira(Math.abs(Number(t.amount)))}
                    </td>
                  </tr>
                ))}
                {acc.transactions.length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-muted">No activity yet.</td></tr>
                )}
              </Table>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
