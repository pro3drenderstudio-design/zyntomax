import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@zyntomax/db";
import { requireSession } from "@/lib/auth";
import { formatNaira, formatKg } from "@/components/ui";
import { PrintButton } from "../print-button";

export const metadata = { title: "Invoice" };

export default async function InvoiceDocPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const order = await prisma.salesOrder.findUnique({
    where: { id },
    include: { customer: true, items: { include: { materialType: true } }, invoice: { include: { payments: true } } },
  });
  if (!order) notFound();

  const inv = order.invoice;
  const total = order.items.reduce((s, i) => s + Number(i.qtyKg) * Number(i.unitPrice), 0);
  const paid = inv?.payments.reduce((s, p) => s + Number(p.amount), 0) ?? 0;
  const balance = (inv ? Number(inv.amount) : total) - paid;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href={`/orders/${order.id}`} className="text-sm text-accent hover:underline">← Back to sale</Link>
        <PrintButton />
      </div>

      <div className="mx-auto max-w-[800px] rounded-xl border border-border bg-white p-8 text-slate-900 shadow-sm print:border-0 print:shadow-none">
        <div className="flex items-start justify-between border-b-2 border-[#008037] pb-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="" className="h-12 w-12 object-contain" />
            <div>
              <p className="text-lg font-bold">ZYNTOMAX VENTURES LIMITED</p>
              <p className="text-xs text-slate-500">Recycling Operations · Lagos, Nigeria</p>
              <p className="text-xs text-slate-500">08038830882</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tracking-tight text-[#008037]">INVOICE</p>
            <p className="tabular text-sm font-medium">{inv?.invoiceNo ?? order.orderNo}</p>
            <p className="text-xs text-slate-500">{order.createdAt.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Bill to</p>
            <p className="font-medium">{order.customer.name}</p>
            {order.customer.contactName && <p className="text-slate-600">{order.customer.contactName}</p>}
            {order.customer.phone && <p className="text-slate-600">{order.customer.phone}</p>}
          </div>
          <div className="text-right">
            {inv && <p><span className="text-slate-400">Due date: </span>{inv.dueDate.toLocaleDateString("en-NG")}</p>}
            {order.waybillNo && <p><span className="text-slate-400">Waybill: </span>{order.waybillNo}</p>}
            {order.driverName && <p><span className="text-slate-400">Driver: </span>{order.driverName}</p>}
            {order.truckNo && <p><span className="text-slate-400">Truck: </span>{order.truckNo}</p>}
          </div>
        </div>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2">Item</th>
              <th className="py-2 text-right">Qty</th>
              <th className="py-2 text-right">Unit price</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.id} className="border-b border-slate-100">
                <td className="py-2">{i.isInventory ? i.materialType?.name : i.description}</td>
                <td className="tabular py-2 text-right">{i.isInventory ? formatKg(Number(i.qtyKg)) : "—"}</td>
                <td className="tabular py-2 text-right">{formatNaira(Number(i.unitPrice))}{i.isInventory ? "/kg" : ""}</td>
                <td className="tabular py-2 text-right">{formatNaira(Number(i.qtyKg) * Number(i.unitPrice))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 flex justify-end">
          <div className="w-64 text-sm">
            <div className="flex justify-between py-1"><span className="text-slate-500">Subtotal</span><span className="tabular">{formatNaira(total)}</span></div>
            <div className="flex justify-between py-1"><span className="text-slate-500">Paid</span><span className="tabular">{formatNaira(paid)}</span></div>
            <div className="mt-1 flex justify-between border-t-2 border-slate-300 py-2 text-base font-bold"><span>Balance due</span><span className="tabular">{formatNaira(balance)}</span></div>
          </div>
        </div>

        <p className="mt-8 border-t border-slate-200 pt-3 text-center text-xs text-slate-400">
          Thank you for your business. Payments to Zyntomax Ventures Limited · 08038830882
        </p>
      </div>
    </div>
  );
}
