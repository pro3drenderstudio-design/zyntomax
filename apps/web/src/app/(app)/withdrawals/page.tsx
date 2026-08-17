import { prisma } from "@zyntomax/db";
import { requireSession, hasRole } from "@/lib/auth";
import { PageHeader, Card, Badge, statusTone, Table, StatCard, formatNaira, buttonClass } from "@/components/ui";
import { approveWithdrawal, rejectWithdrawal } from "./actions";

export default async function WithdrawalsPage() {
  const session = await requireSession();
  const isFinance = hasRole(session, ["FINANCE_ADMIN"]);

  const withdrawals = await prisma.withdrawal.findMany({
    include: { vendor: true },
    orderBy: { requestedAt: "desc" },
    take: 100,
  });

  const pending = withdrawals.filter((w) => w.status === "PENDING" || w.status === "APPROVED");
  const pendingTotal = pending.reduce((s, w) => s + Number(w.amount), 0);
  const paidTotal = withdrawals.filter((w) => w.status === "PAID").reduce((s, w) => s + Number(w.amount), 0);

  return (
    <div>
      <PageHeader title="Vendor withdrawals" subtitle="Vendors cash out their wallet balance — approve to send a Paystack transfer" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Pending requests" value={String(pending.length)} tone={pending.length > 0 ? "warning" : "default"} />
        <StatCard label="Pending amount" value={formatNaira(pendingTotal)} />
        <StatCard label="Paid (all-time)" value={formatNaira(paidTotal)} />
      </div>

      <div className="mt-4">
        <Table headers={["Requested", "Vendor", "Bank", "Amount", "Status", isFinance ? "Action" : ""]}>
          {withdrawals.map((w) => (
            <tr key={w.id}>
              <td className="px-3 py-2">{w.requestedAt.toLocaleDateString("en-NG")}</td>
              <td className="px-3 py-2 font-medium">{w.vendor.name}<span className="block text-xs text-muted">{w.vendor.phone}</span></td>
              <td className="px-3 py-2 text-muted">{w.bankName ?? "—"}{w.accountLast4 ? ` ••${w.accountLast4}` : ""}</td>
              <td className="tabular px-3 py-2 font-medium">{formatNaira(Number(w.amount))}</td>
              <td className="px-3 py-2">
                <Badge tone={statusTone(w.status)}>{w.status}</Badge>
                {w.failureReason ? <span className="block text-xs text-destructive">{w.failureReason}</span> : null}
              </td>
              {isFinance ? (
                <td className="px-3 py-2">
                  {(w.status === "PENDING" || w.status === "APPROVED") ? (
                    <div className="flex gap-2">
                      <form action={approveWithdrawal.bind(null, w.id)}>
                        <button type="submit" className={`${buttonClass} px-3 py-1.5`}>Pay</button>
                      </form>
                      <form action={rejectWithdrawal.bind(null, w.id)}>
                        <button type="submit" className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted-bg">Reject</button>
                      </form>
                    </div>
                  ) : "—"}
                </td>
              ) : <td />}
            </tr>
          ))}
          {withdrawals.length === 0 && (
            <tr><td colSpan={6} className="px-3 py-6 text-center text-sm text-muted">No withdrawal requests yet.</td></tr>
          )}
        </Table>
      </div>
    </div>
  );
}
