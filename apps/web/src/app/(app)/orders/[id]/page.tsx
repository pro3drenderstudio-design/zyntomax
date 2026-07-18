import { notFound } from "next/navigation";
import { prisma } from "@zyntomax/db";
import { requireSession, hasRole } from "@/lib/auth";
import {
  PageHeader, Card, Table, Badge, statusTone, StatCard, formatKg, formatNaira,
} from "@/components/ui";
import { InvoicePaymentForm } from "../../invoices/payment-form";

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const order = await prisma.salesOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      items: { include: { product: true } },
      invoice: { include: { payments: true } },
    },
  });
  if (!order) notFound();

  const total = order.items.reduce((s, i) => s + Number(i.qtyKg) * Number(i.unitPrice), 0);
  const inv = order.invoice;
  const paid = inv?.payments.reduce((s, p) => s + Number(p.amount), 0) ?? 0;
  const open = inv ? Number(inv.amount) - paid : 0;
  const canRecord = hasRole(session, ["FINANCE_ADMIN", "SALES_ADMIN"]);

  return (
    <div>
      <PageHeader
        title={order.orderNo}
        subtitle={`${order.customer.name} · ${order.createdAt.toLocaleString("en-NG")}`}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Sale total" value={formatNaira(total)} />
        <StatCard label="Invoice" value={inv?.invoiceNo ?? "—"} />
        <StatCard label="Paid" value={formatNaira(paid)} tone="accent" />
        <StatCard label="Outstanding" value={formatNaira(open)} tone={open > 0 ? "warning" : "default"} />
      </div>

      <h2 className="mb-2 mt-6 font-medium">Sale lines</h2>
      <Table headers={["Item", "Type", "Qty", "Unit price", "Line total"]}>
        {order.items.map((i) => (
          <tr key={i.id}>
            <td className="px-3 py-2 font-medium">{i.isInventory ? i.product?.name : i.description}</td>
            <td className="px-3 py-2">
              {i.isInventory ? <Badge tone="info">Finished goods</Badge> : <Badge tone="neutral">Non-inventory</Badge>}
            </td>
            <td className="tabular px-3 py-2">{i.isInventory ? formatKg(Number(i.qtyKg)) : "—"}</td>
            <td className="tabular px-3 py-2">{formatNaira(Number(i.unitPrice))}{i.isInventory ? "/kg" : ""}</td>
            <td className="tabular px-3 py-2 font-medium">{formatNaira(Number(i.qtyKg) * Number(i.unitPrice))}</td>
          </tr>
        ))}
      </Table>

      {inv && (
        <Card className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-medium">
                {inv.invoiceNo} · <Badge tone={statusTone(open > 0 ? (inv.dueDate < new Date() ? "OVERDUE" : "UNPAID") : "PAID")}>
                  {open > 0 ? (inv.dueDate < new Date() ? "OVERDUE" : "UNPAID") : "PAID"}
                </Badge>
              </p>
              <p className="tabular text-sm text-muted">
                {formatNaira(paid)} of {formatNaira(Number(inv.amount))} · due {inv.dueDate.toLocaleDateString("en-NG")}
              </p>
            </div>
            {canRecord && open > 0 && <InvoicePaymentForm invoiceId={inv.id} />}
          </div>
        </Card>
      )}
    </div>
  );
}
