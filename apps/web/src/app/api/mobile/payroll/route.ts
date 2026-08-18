import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { mobileSession, mobileHasRole } from "@/lib/mobile-auth";
import { openPayrollRun } from "@/lib/payroll";

const ROLES = ["FINANCE_ADMIN", "HR_ADMIN"] as const;

/** Recent payroll runs + sites (for opening this week's run). */
export async function GET(request: NextRequest) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mobileHasRole(session, [...ROLES])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [runs, sites] = await Promise.all([
    prisma.payrollRun.findMany({
      include: { site: true, items: true },
      orderBy: { weekStart: "desc" },
      take: 8,
    }),
    prisma.site.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  return NextResponse.json({
    sites: sites.map((s) => ({ id: s.id, name: s.name })),
    runs: runs.map((r) => {
      const net = r.items.reduce((t, i) => t + Number(i.netAmount), 0);
      const unpaid = r.items.filter((i) => i.paidAt === null).length;
      return {
        id: r.id,
        site: r.site.name,
        weekStart: r.weekStart,
        weekEnd: r.weekEnd,
        status: r.status,
        staffCount: r.items.length,
        unpaidCount: unpaid,
        netTotal: net,
      };
    }),
  });
}

/** Open (or refresh) this week's payroll run for a site. */
export async function POST(request: NextRequest) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mobileHasRole(session, [...ROLES])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { siteId } = (await request.json()) as { siteId?: string };
  if (!siteId) return NextResponse.json({ error: "siteId required" }, { status: 422 });

  const res = await openPayrollRun(siteId, session.userId);
  return NextResponse.json({ ok: true, staff: res.staff });
}
