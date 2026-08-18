import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { mobileSession, mobileHasRole } from "@/lib/mobile-auth";

/** Staff detail: profile, roles, wage, outstanding advance, recent payslips. */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mobileHasRole(session, ["HR_ADMIN", "OPERATIONS_MANAGER"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;

  const s = await prisma.staffProfile.findUnique({
    where: { id },
    include: {
      user: { include: { roles: true } },
      advances: true,
      payrollItems: { include: { run: true }, orderBy: { run: { weekStart: "desc" } }, take: 8 },
    },
  });
  if (!s) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const outstandingAdvance = s.advances.reduce((t, a) => t + (Number(a.amount) - Number(a.repaidAmount)), 0);
  const totalEarned = s.payrollItems.reduce((t, i) => t + Number(i.earnedAmount), 0);

  return NextResponse.json({
    id: s.id,
    staffNo: s.staffNo,
    name: s.user.name,
    phone: s.user.phone,
    title: s.title,
    wageModel: s.wageModel,
    baseSalaryWeekly: s.baseSalaryWeekly === null ? null : Number(s.baseSalaryWeekly),
    status: s.user.status,
    hireDate: s.hireDate,
    roles: [...new Set(s.user.roles.map((r) => r.role))],
    outstandingAdvance,
    totalEarned,
    payslips: s.payrollItems.map((i) => ({
      id: i.id,
      weekStart: i.run.weekStart,
      earnedAmount: Number(i.earnedAmount),
      advanceDeduction: Number(i.advanceDeduction),
      discrepancyDeduction: Number(i.discrepancyDeduction),
      netAmount: Number(i.netAmount),
      paid: i.paidAt !== null,
    })),
  });
}
