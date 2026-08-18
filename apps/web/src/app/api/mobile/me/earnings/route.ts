import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { mobileSession } from "@/lib/mobile-auth";
import { computeStaffEarnings } from "@/lib/wages";

/** The signed-in staff member's own live (un-payrolled) earnings + recent payslips. */
export async function GET(request: NextRequest) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const staff = await prisma.staffProfile.findUnique({ where: { userId: session.userId } });
  if (!staff) return NextResponse.json({ error: "No staff profile" }, { status: 404 });

  const [live, advances, payslips] = await Promise.all([
    computeStaffEarnings(staff.id),
    prisma.salaryAdvance.findMany({ where: { staffId: staff.id } }),
    prisma.payrollItem.findMany({
      where: { staffId: staff.id },
      include: { run: true },
      orderBy: { run: { weekStart: "desc" } },
      take: 8,
    }),
  ]);

  const outstandingAdvance = advances.reduce((t, a) => t + (Number(a.amount) - Number(a.repaidAmount)), 0);

  return NextResponse.json({
    staffNo: staff.staffNo,
    title: staff.title,
    ...live,
    outstandingAdvance,
    payslips: payslips.map((i) => ({
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
