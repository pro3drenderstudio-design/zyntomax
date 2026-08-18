import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { mobileSession, mobileHasRole } from "@/lib/mobile-auth";

/** One payroll run's payslip lines. */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mobileHasRole(session, ["FINANCE_ADMIN", "HR_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;

  const run = await prisma.payrollRun.findUnique({
    where: { id },
    include: { site: true, items: { include: { staff: { include: { user: true } } }, orderBy: { netAmount: "desc" } } },
  });
  if (!run) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const canPay = mobileHasRole(session, ["FINANCE_ADMIN"]);
  return NextResponse.json({
    id: run.id,
    site: run.site.name,
    weekStart: run.weekStart,
    weekEnd: run.weekEnd,
    status: run.status,
    canPay,
    netTotal: run.items.reduce((t, i) => t + Number(i.netAmount), 0),
    items: run.items.map((i) => ({
      id: i.id,
      staff: i.staff.user.name,
      staffNo: i.staff.staffNo,
      commissionAmount: Number(i.commissionAmount),
      baseAmount: Number(i.baseAmount),
      advanceDeduction: Number(i.advanceDeduction),
      discrepancyDeduction: Number(i.discrepancyDeduction),
      netAmount: Number(i.netAmount),
      paid: i.paidAt !== null,
      paymentRef: i.paymentRef,
    })),
  });
}
