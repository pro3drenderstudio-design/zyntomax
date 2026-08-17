import { prisma } from "@zyntomax/db";

export type VendorBalance = {
  earned: number; // Σ weigh-in amounts
  paidOut: number; // Σ released trip payouts (legacy/coexistence)
  withdrawn: number; // Σ active withdrawals (pending/approved/paid)
  available: number; // earned − paidOut − withdrawn
};

/**
 * A vendor's wallet is computed from the append-only records — never stored.
 * available = earnings − already-paid trip payouts − active withdrawals.
 */
export async function vendorBalance(vendorId: string): Promise<VendorBalance> {
  const [weighAgg, payoutAgg, wdAgg] = await Promise.all([
    prisma.collectionWeighIn.aggregate({ where: { vendorId }, _sum: { amount: true } }),
    prisma.payout.aggregate({ where: { vendorId, status: "SUCCESS" }, _sum: { amount: true } }),
    prisma.withdrawal.aggregate({
      where: { vendorId, status: { in: ["PENDING", "APPROVED", "PAID"] } },
      _sum: { amount: true },
    }),
  ]);
  const earned = Number(weighAgg._sum.amount ?? 0);
  const paidOut = Number(payoutAgg._sum.amount ?? 0);
  const withdrawn = Number(wdAgg._sum.amount ?? 0);
  return { earned, paidOut, withdrawn, available: Math.max(0, earned - paidOut - withdrawn) };
}
