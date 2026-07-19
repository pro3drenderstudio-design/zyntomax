import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { vendorFromRequest } from "@/lib/vendor-auth";

/** Vendor home payload: profile, rewards progress, recent collections & payments. */
export async function GET(request: NextRequest) {
  const vendorId = await vendorFromRequest(request);
  if (!vendorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [vendor, weighIns, payouts, tiers, grants] = await Promise.all([
    prisma.vendor.findUnique({ where: { id: vendorId }, include: { locality: true } }),
    prisma.collectionWeighIn.findMany({
      where: { vendorId },
      include: { materialType: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.payout.findMany({ where: { vendorId }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.rewardTier.findMany({ where: { active: true }, orderBy: { thresholdKg: "asc" } }),
    prisma.rewardGrant.findMany({ where: { vendorId }, include: { tier: true } }),
  ]);
  if (!vendor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const lifetimeKg = weighIns.reduce((s, w) => s + Number(w.weightKg), 0);
  const lifetimeNaira = weighIns.reduce((s, w) => s + Number(w.amount), 0);
  const nextTier = tiers.find(
    (t) => Number(t.thresholdKg) > lifetimeKg && !grants.some((g) => g.tierId === t.id),
  );

  return NextResponse.json({
    vendor: {
      id: vendor.id, name: vendor.name, nickname: vendor.nickname, vendorNo: vendor.vendorNo,
      phone: vendor.phone, locality: vendor.locality?.name ?? null,
      bankVerified: vendor.bankVerified, bankName: vendor.bankName,
    },
    lifetimeKg, lifetimeNaira,
    rewards: {
      tiers: tiers.map((t) => ({ name: t.name, thresholdKg: Number(t.thresholdKg), reward: t.reward, earned: grants.some((g) => g.tierId === t.id) })),
      next: nextTier ? { name: nextTier.name, thresholdKg: Number(nextTier.thresholdKg), reward: nextTier.reward, remainingKg: Number(nextTier.thresholdKg) - lifetimeKg } : null,
    },
    collections: weighIns.map((w) => ({
      id: w.id, date: w.createdAt, material: w.materialType.name,
      weightKg: Number(w.weightKg), amount: Number(w.amount),
    })),
    payments: payouts.map((p) => ({
      id: p.id, date: p.createdAt, amount: Number(p.amount), status: p.status, reference: p.paystackRef,
    })),
  });
}
