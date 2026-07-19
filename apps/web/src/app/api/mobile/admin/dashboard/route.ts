import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { mobileSession, mobileHasRole } from "@/lib/mobile-auth";
import { inventoryBuckets } from "@/lib/inventory";
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
    vendorCount, todayCollected, flaggedJobs, buckets, walletAgg,
    reconciledTrips, readyBatches, activeTrips,
  ] = await Promise.all([
    prisma.vendor.count({ where: { status: "ACTIVE" } }),
    prisma.collectionWeighIn.aggregate({ _sum: { weightKg: true, amount: true }, where: { createdAt: { gte: dayStart } } }),
    prisma.job.count({ where: { status: "FLAGGED" } }),
    inventoryBuckets(null),
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

  const sumKg = (arr: { kg: number }[]) => arr.reduce((s, m) => s + m.kg, 0);
  const wip = sumKg(buckets.waiting) + buckets.active.reduce((s, st) => s + sumKg(st.materials), 0);
  const finished = sumKg(buckets.finished);
  const intake = sumKg(buckets.raw);

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
