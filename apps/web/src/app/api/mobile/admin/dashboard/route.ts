import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { mobileSession, mobileHasRole } from "@/lib/mobile-auth";
import { locationBalances } from "@/lib/inventory";
import { startOfDay } from "date-fns";

/** On-the-go admin dashboard: KPIs + pending approvals. */
export async function GET(request: NextRequest) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mobileHasRole(session, ["OPERATIONS_MANAGER", "FACTORY_SUPERVISOR", "FINANCE_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dayStart = startOfDay(new Date());
  const [
    vendorCount, todayCollected, flaggedJobs, balances, walletAgg,
    reconciledTrips, readyBatches, activeTrips,
  ] = await Promise.all([
    prisma.vendor.count({ where: { status: "ACTIVE" } }),
    prisma.collectionWeighIn.aggregate({ _sum: { weightKg: true, amount: true }, where: { createdAt: { gte: dayStart } } }),
    prisma.job.count({ where: { status: "FLAGGED" } }),
    locationBalances(null),
    prisma.walletTransaction.aggregate({ _sum: { amount: true } }),
    prisma.trip.findMany({
      where: { status: "RECONCILED" },
      include: { locality: true, weighIns: { select: { amount: true, vendorId: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.payoutBatch.findMany({
      where: { status: { in: ["READY", "AWAITING_FUNDS", "PARTIAL_FAILED"] } },
      include: { trip: { include: { locality: true } }, payouts: true },
    }),
    prisma.trip.count({ where: { status: { in: ["PLANNED", "IN_PROGRESS"] } } }),
  ]);

  const wip = balances.filter((b) => b.kind === "STAGE_WIP").reduce((s, b) => s + b.totalKg, 0);
  const finished = balances.filter((b) => b.kind === "FINISHED_STORE").reduce((s, b) => s + b.totalKg, 0);
  const intake = balances.filter((b) => b.kind === "INTAKE").reduce((s, b) => s + b.totalKg, 0);

  return NextResponse.json({
    kpis: {
      activeVendors: vendorCount,
      collectedTodayKg: Number(todayCollected._sum.weightKg ?? 0),
      collectedTodayNaira: Number(todayCollected._sum.amount ?? 0),
      intakeKg: intake,
      wipKg: wip,
      finishedKg: finished,
      walletBalance: Number(walletAgg._sum.amount ?? 0),
      flaggedJobs,
      activeTrips,
    },
    approvals: {
      reconciledTrips: reconciledTrips.map((t) => ({
        id: t.id,
        locality: t.locality?.name ?? "Route",
        date: t.date,
        payout: t.weighIns.reduce((s, w) => s + Number(w.amount), 0),
        vendors: new Set(t.weighIns.map((w) => w.vendorId)).size,
      })),
      readyBatches: readyBatches.map((b) => ({
        id: b.id,
        locality: b.trip.locality?.name ?? "Trip",
        total: Number(b.totalAmount),
        vendors: b.payouts.length,
        status: b.status,
      })),
    },
  });
}
