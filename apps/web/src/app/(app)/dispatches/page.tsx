import Link from "next/link";
import { prisma } from "@zyntomax/db";
import { requireSession } from "@/lib/auth";
import { PageHeader, Table, Badge, statusTone, formatKg, formatNaira } from "@/components/ui";

export default async function DispatchesPage() {
  await requireSession();

  const dispatches = await prisma.dispatch.findMany({
    include: {
      order: { include: { customer: true } },
      items: { include: { product: true } },
      invoice: true,
    },
    orderBy: { dispatchedAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader title="Dispatches" subtitle="Goods that left the gate, with waybills and invoices" />

      <Table headers={["Waybill", "Date", "Customer", "Goods", "Vehicle", "Invoice", "Status"]}>
        {dispatches.map((d) => (
          <tr key={d.id}>
            <td className="tabular px-3 py-2 font-medium">{d.waybillNo}</td>
            <td className="px-3 py-2">{d.dispatchedAt.toLocaleDateString("en-NG")}</td>
            <td className="px-3 py-2">
              <Link href={`/orders/${d.orderId}`} className="hover:underline">
                {d.order.customer.name}
              </Link>
            </td>
            <td className="px-3 py-2 text-sm">
              {d.items.map((i) => `${i.product.name} ${formatKg(Number(i.weightKg))}`).join(", ")}
            </td>
            <td className="px-3 py-2 text-muted">{d.vehicle ?? "—"}</td>
            <td className="tabular px-3 py-2">
              {d.invoice ? `${d.invoice.invoiceNo} · ${formatNaira(Number(d.invoice.amount))}` : "—"}
            </td>
            <td className="px-3 py-2">
              <Badge tone={statusTone(d.status)}>{d.status}</Badge>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
