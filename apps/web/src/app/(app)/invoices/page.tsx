import Link from "next/link";
import { prisma } from "@zyntomax/db";
import { requireSession, hasRole } from "@/lib/auth";
import {
  PageHeader, Table, Badge, statusTone, StatCard, formatNaira,
} from "@/components/ui";
import { InvoicePaymentForm } from "./payment-form";

export default async function InvoicesPage() {
  const session = await requireSession();
  const canRecord = hasRole(session, ["FINANCE_ADMIN", "SALES_ADMIN"]);

  const invoices = await prisma.invoice.findMany({
    include: {
      payments: true,
      salesOrder: { include: { customer: true } },
      dispatch: { include: { order: { include: { customer: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const now = Date.now();
  const enriched = invoices.map((inv) => {
    const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
    const open = Number(inv.amount) - paid;
    const daysOverdue =
      open > 0 ? Math.floor((now - inv.dueDate.getTime()) / 86400000) : 0;
    const customer = inv.salesOrder?.customer ?? inv.dispatch?.order.customer;
    const orderId = inv.salesOrderId ?? inv.dispatch?.orderId;
    return { inv, paid, open, daysOverdue, customerName: customer?.name ?? "—", orderId };
  });

  const buckets = {
    current: enriched.filter((e) => e.open > 0 && e.daysOverdue <= 0).reduce((s, e) => s + e.open, 0),
    d30: enriched.filter((e) => e.open > 0 && e.daysOverdue > 0 && e.daysOverdue <= 30).reduce((s, e) => s + e.open, 0),
    d60: enriched.filter((e) => e.open > 0 && e.daysOverdue > 30 && e.daysOverdue <= 60).reduce((s, e) => s + e.open, 0),
    d90: enriched.filter((e) => e.open > 0 && e.daysOverdue > 60).reduce((s, e) => s + e.open, 0),
  };

  return (
    <div>
      <PageHeader title="Invoices & receivables" subtitle="Generated automatically on dispatch" />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Current (not due)" value={formatNaira(buckets.current)} />
        <StatCard label="Overdue 1–30 days" value={formatNaira(buckets.d30)} tone={buckets.d30 > 0 ? "warning" : "default"} />
        <StatCard label="Overdue 31–60 days" value={formatNaira(buckets.d60)} tone={buckets.d60 > 0 ? "warning" : "default"} />
        <StatCard label="Overdue 60+ days" value={formatNaira(buckets.d90)} tone={buckets.d90 > 0 ? "destructive" : "default"} />
      </div>

      <div className="mt-4">
        <Table headers={["Invoice", "Customer", "Amount", "Paid", "Due date", "Status", canRecord ? "Record payment" : ""]}>
          {enriched.map(({ inv, paid, open, daysOverdue, customerName, orderId }) => {
            const displayStatus =
              open > 0 && daysOverdue > 0 ? "OVERDUE" : inv.status;
            return (
              <tr key={inv.id}>
                <td className="px-3 py-2">
                  <Link href={orderId ? `/orders/${orderId}` : "#"} className="tabular font-medium hover:underline">
                    {inv.invoiceNo}
                  </Link>
                </td>
                <td className="px-3 py-2">{customerName}</td>
                <td className="tabular px-3 py-2">{formatNaira(Number(inv.amount))}</td>
                <td className="tabular px-3 py-2">{formatNaira(paid)}</td>
                <td className="px-3 py-2">
                  {inv.dueDate.toLocaleDateString("en-NG")}
                  {daysOverdue > 0 && open > 0 && (
                    <span className="ml-1 text-xs text-destructive">+{daysOverdue}d</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <Badge tone={statusTone(displayStatus)}>{displayStatus}</Badge>
                </td>
                {canRecord ? (
                  <td className="px-3 py-2">
                    {open > 0 ? <InvoicePaymentForm invoiceId={inv.id} /> : "—"}
                  </td>
                ) : (
                  <td />
                )}
              </tr>
            );
          })}
        </Table>
      </div>
    </div>
  );
}
