import { notFound } from "next/navigation";
import { prisma } from "@zyntomax/db";
import { requireSession, hasRole } from "@/lib/auth";
import {
  PageHeader, Card, Table, Badge, statusTone, formatKg, formatNaira,
} from "@/components/ui";
import { DispatchForm } from "../order-forms";

export default async function OrderDetailPage({
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
      dispatches: {
        include: {
          items: { include: { product: true } },
          invoice: { include: { payments: true } },
        },
        orderBy: { dispatchedAt: "desc" },
      },
    },
  });
  if (!order) notFound();

  const canDispatch =
    hasRole(session, ["SALES_ADMIN", "FACTORY_SUPERVISOR", "OPERATIONS_MANAGER"], order.siteId) &&
    ["CONFIRMED", "PARTIALLY_DISPATCHED"].includes(order.status);

  return (
    <div>
      <PageHeader
        title={order.orderNo}
        subtitle={`${order.customer.name} · ${order.createdAt.toLocaleDateString("en-NG")}`}
        action={<Badge tone={statusTone(order.status)}>{order.status.replace(/_/g, " ")}</Badge>}
      />

      <h2 className="mb-2 font-medium">Order lines</h2>
      <Table headers={["Product", "Quantity", "Unit price", "Line total"]}>
        {order.items.map((i) => (
          <tr key={i.id}>
            <td className="px-3 py-2 font-medium">{i.product.name}</td>
            <td className="tabular px-3 py-2">{formatKg(Number(i.qtyKg))}</td>
            <td className="tabular px-3 py-2">{formatNaira(Number(i.unitPrice))}/kg</td>
            <td className="tabular px-3 py-2 font-medium">
              {formatNaira(Number(i.qtyKg) * Number(i.unitPrice))}
            </td>
          </tr>
        ))}
      </Table>

      {canDispatch && (
        <Card className="mt-4">
          <h2 className="mb-1 font-medium">New dispatch</h2>
          <p className="mb-3 text-sm text-muted">
            Scale each product at the gate — the invoice is generated on the scaled weight.
          </p>
          <DispatchForm
            orderId={order.id}
            orderProducts={order.items.map((i) => ({ id: i.productId, name: i.product.name }))}
          />
        </Card>
      )}

      <h2 className="mb-2 mt-6 font-medium">Dispatches</h2>
      {order.dispatches.length === 0 ? (
        <Card><p className="py-4 text-center text-sm text-muted">Nothing dispatched yet.</p></Card>
      ) : (
        <div className="flex flex-col gap-3">
          {order.dispatches.map((d) => {
            const paid = d.invoice?.payments.reduce((s, p) => s + Number(p.amount), 0) ?? 0;
            return (
              <Card key={d.id}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    <span className="tabular">{d.waybillNo}</span>
                    <span className="ml-2 text-sm text-muted">
                      {d.dispatchedAt.toLocaleString("en-NG")}
                      {d.vehicle && ` · ${d.vehicle}`}
                      {d.driverName && ` · ${d.driverName}`}
                    </span>
                  </p>
                  {d.invoice && (
                    <span className="flex items-center gap-2 text-sm">
                      <span className="tabular">{d.invoice.invoiceNo}</span>
                      <Badge tone={statusTone(d.invoice.status)}>{d.invoice.status}</Badge>
                      <span className="tabular">
                        {formatNaira(paid)} / {formatNaira(Number(d.invoice.amount))}
                      </span>
                    </span>
                  )}
                </div>
                <ul className="flex flex-wrap gap-4 text-sm">
                  {d.items.map((i) => (
                    <li key={i.id} className="tabular">
                      {i.product.name}: <strong>{formatKg(Number(i.weightKg))}</strong>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
