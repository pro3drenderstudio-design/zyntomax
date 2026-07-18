import { prisma } from "@zyntomax/db";
import { audit } from "./audit";

/**
 * Approve a reconciled trip → creates the payout batch (money is not moved
 * yet; finance releases it). Shared by the web server action and the mobile
 * admin endpoint so the logic is identical everywhere.
 */
export async function approveTripById(
  tripId: string,
  actorId: string,
): Promise<{ ok: true; total: number; vendors: number } | { ok: false; error: string }> {
  const trip = await prisma.trip.findUnique({
    where: { id: tripId },
    include: { weighIns: true, reconciliation: true, payoutBatch: true },
  });
  if (!trip) return { ok: false, error: "Trip not found." };
  if (trip.status !== "RECONCILED" || !trip.reconciliation) {
    return { ok: false, error: "Trip must be reconciled before approval." };
  }
  if (trip.payoutBatch) return { ok: true, total: Number(trip.payoutBatch.totalAmount), vendors: 0 };

  // Vendors are paid on the FIELD weigh-in amount
  const perVendor = new Map<string, number>();
  for (const w of trip.weighIns) {
    perVendor.set(w.vendorId, (perVendor.get(w.vendorId) ?? 0) + Number(w.amount));
  }
  const total = [...perVendor.values()].reduce((s, v) => s + v, 0);

  await prisma.$transaction(async (tx) => {
    await tx.tripReconciliation.update({
      where: { tripId },
      data: { approvedBy: actorId, approvedAt: new Date() },
    });
    await tx.payoutBatch.create({
      data: {
        tripId,
        totalAmount: total,
        payouts: {
          create: [...perVendor.entries()].map(([vendorId, amount]) => ({
            vendorId,
            amount,
            idempotencyKey: `payout_${tripId}_${vendorId}`,
          })),
        },
      },
    });
    await tx.trip.update({ where: { id: tripId }, data: { status: "APPROVED" } });
  });

  await audit({
    actorId,
    action: "trip.approve",
    entity: "Trip",
    entityId: tripId,
    after: { totalPayout: total, vendors: perVendor.size },
  });

  return { ok: true, total, vendors: perVendor.size };
}
