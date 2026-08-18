import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { mobileSession, mobileHasRole } from "@/lib/mobile-auth";
import { accessibleSiteIds } from "@/lib/auth";

const ROLES = ["SALES_ADMIN", "FINANCE_ADMIN", "OPERATIONS_MANAGER"] as const;

/** Sales orders with invoice status + AR aging summary. */
export async function GET(request: NextRequest) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mobileHasRole(session, [...ROLES])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const siteIds = accessibleSiteIds(session);
  const orders = await prisma.salesOrder.findMany({
    where: siteIds ? { siteId: { in: siteIds } } : {},
    include: { customer: true, items: { include: { materialType: true } }, invoice: { include: { payments: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const now = Date.now();
  const aging = { current: 0, d1_30: 0, d31_60: 0, d60plus: 0 };
  let outstandingTotal = 0;

  const rows = orders.map((o) => {
    const total = o.items.reduce((s, i) => s + Number(i.qtyKg) * Number(i.unitPrice), 0);
    const paid = o.invoice ? o.invoice.payments.reduce((s, p) => s + Number(p.amount), 0) : 0;
    const invAmount = o.invoice ? Number(o.invoice.amount) : 0;
    const open = o.invoice ? Math.max(0, invAmount - paid) : 0;
    let invStatus: string = "—";
    if (o.invoice) invStatus = paid >= invAmount ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";

    if (open > 0 && o.invoice) {
      outstandingTotal += open;
      const daysOver = Math.floor((now - new Date(o.invoice.dueDate).getTime()) / 86400000);
      if (daysOver <= 0) aging.current += open;
      else if (daysOver <= 30) aging.d1_30 += open;
      else if (daysOver <= 60) aging.d31_60 += open;
      else aging.d60plus += open;
    }

    return {
      id: o.id,
      orderNo: o.orderNo,
      customer: o.customer.name,
      status: o.status,
      itemNames: o.items.slice(0, 2).map((i) => i.materialType?.name ?? i.description ?? "").filter(Boolean),
      itemCount: o.items.length,
      total,
      paid,
      outstanding: open,
      invoiceNo: o.invoice?.invoiceNo ?? null,
      invoiceStatus: invStatus,
      createdAt: o.createdAt,
    };
  });

  return NextResponse.json({ aging, outstandingTotal, orders: rows });
}
