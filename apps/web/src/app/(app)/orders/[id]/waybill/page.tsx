import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@zyntomax/db";
import { requireSession } from "@/lib/auth";
import { formatKg } from "@/components/ui";
import { PrintButton } from "../print-button";

export const metadata = { title: "Waybill" };

export default async function WaybillPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;
  const order = await prisma.salesOrder.findUnique({
    where: { id },
    include: { customer: true, items: { include: { materialType: true } } },
  });
  if (!order) notFound();

  const invItems = order.items.filter((i) => i.isInventory);
  const totalKg = invItems.reduce((s, i) => s + Number(i.qtyKg), 0);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href={`/orders/${order.id}`} className="text-sm text-accent hover:underline">← Back to sale</Link>
        <PrintButton label="Print waybill" />
      </div>

      <div className="mx-auto max-w-[800px] rounded-xl border border-border bg-white p-8 text-slate-900 shadow-sm print:border-0 print:shadow-none">
        <div className="flex items-start justify-between border-b-2 border-[#008037] pb-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="" className="h-12 w-12 object-contain" />
            <div>
              <p className="text-lg font-bold">ZYNTOMAX VENTURES LIMITED</p>
              <p className="text-xs text-slate-500">Recycling Operations · Lagos, Nigeria · 08038830882</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold tracking-tight text-[#008037]">WAYBILL</p>
            <p className="tabular text-sm font-medium">{order.waybillNo ?? order.orderNo}</p>
            <p className="text-xs text-slate-500">{order.createdAt.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Deliver to</p>
            <p className="font-medium">{order.customer.name}</p>
            {order.customer.address && <p className="text-slate-600">{order.customer.address}</p>}
            {order.customer.phone && <p className="text-slate-600">{order.customer.phone}</p>}
          </div>
          <div className="text-right text-sm">
            <p><span className="text-slate-400">Order: </span>{order.orderNo}</p>
            <p><span className="text-slate-400">Driver: </span>{order.driverName ?? "—"}</p>
            <p><span className="text-slate-400">Truck: </span>{order.truckNo ?? "—"}</p>
          </div>
        </div>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="py-2">Material</th>
              <th className="py-2 text-right">Quantity</th>
            </tr>
          </thead>
          <tbody>
            {invItems.map((i) => (
              <tr key={i.id} className="border-b border-slate-100">
                <td className="py-2">{i.materialType?.name}</td>
                <td className="tabular py-2 text-right">{formatKg(Number(i.qtyKg))}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-300 font-bold">
              <td className="py-2">Total</td>
              <td className="tabular py-2 text-right">{formatKg(totalKg)}</td>
            </tr>
          </tbody>
        </table>

        <div className="mt-12 grid grid-cols-2 gap-8 text-sm">
          <div>
            <div className="h-10 border-b border-slate-400" />
            <p className="mt-1 text-xs text-slate-500">Dispatched by (name & signature)</p>
          </div>
          <div>
            <div className="h-10 border-b border-slate-400" />
            <p className="mt-1 text-xs text-slate-500">Received by (name, signature & date)</p>
          </div>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">
          Goods received in good order. This waybill accompanies the delivery and must be signed on receipt.
        </p>
      </div>
    </div>
  );
}
