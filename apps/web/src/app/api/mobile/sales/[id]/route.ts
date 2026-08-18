import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { mobileSession, mobileHasRole } from "@/lib/mobile-auth";

/** Sales order detail: lines, totals, invoice + payments. */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mobileHasRole(session, ["SALES_ADMIN", "FINANCE_ADMIN", "OPERATIONS_MANAGER"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;

  const o = await prisma.salesOrder.findUnique({
    where: { id },
    include: { customer: true, items: { include: { materialType: true } }, invoice: { include: { payments: true } } },
  });
  if (!o) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const total = o.items.reduce((s, i) => s + Number(i.qtyKg) * Number(i.unitPrice), 0);
  const paid = o.invoice ? o.invoice.payments.reduce((s, p) => s + Number(p.amount), 0) : 0;
  const invAmount = o.invoice ? Number(o.invoice.amount) : 0;
  const open = o.invoice ? Math.max(0, invAmount - paid) : 0;
  const overdue = !!o.invoice && open > 0 && new Date(o.invoice.dueDate).getTime() < Date.now();

  return NextResponse.json({
    id: o.id,
    orderNo: o.orderNo,
    customer: { name: o.customer.name, phone: o.customer.phone, contactName: o.customer.contactName },
    status: o.status,
    driverName: o.driverName,
    truckNo: o.truckNo,
    waybillNo: o.waybillNo,
    createdAt: o.createdAt,
    total,
    lines: o.items.map((i) => ({
      name: i.materialType?.name ?? i.description ?? "Item",
      isInventory: i.isInventory,
      qtyKg: Number(i.qtyKg),
      unitPrice: Number(i.unitPrice),
      lineTotal: Number(i.qtyKg) * Number(i.unitPrice),
    })),
    invoice: o.invoice
      ? {
          invoiceNo: o.invoice.invoiceNo,
          amount: invAmount,
          paid,
          outstanding: open,
          dueDate: o.invoice.dueDate,
          status: overdue ? "OVERDUE" : paid >= invAmount ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID",
          payments: o.invoice.payments.map((p) => ({ amount: Number(p.amount), method: p.method, reference: p.reference, paidAt: p.paidAt })),
        }
      : null,
  });
}
