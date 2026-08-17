import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { vendorFromRequest } from "@/lib/vendor-auth";
import { vendorBalance } from "@/lib/vendor-wallet";
import { getSetting } from "@/lib/settings";

/** Wallet summary: balance, bank status, and withdrawal history. */
export async function GET(request: NextRequest) {
  const vendorId = await vendorFromRequest(request);
  if (!vendorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const [balance, withdrawals, minWithdrawal] = await Promise.all([
    vendorBalance(vendorId),
    prisma.withdrawal.findMany({ where: { vendorId }, orderBy: { requestedAt: "desc" }, take: 30 }),
    getSetting<number>("wallet.min_withdrawal", 1000, vendor.siteId),
  ]);

  const last4 = vendor.bankAccountNo ? vendor.bankAccountNo.slice(-4) : null;

  return NextResponse.json({
    ...balance,
    minWithdrawal,
    bank: {
      verified: vendor.bankVerified && !!vendor.paystackRecipient,
      bankName: vendor.bankName,
      accountName: vendor.bankAccountName,
      last4,
    },
    withdrawals: withdrawals.map((w) => ({
      id: w.id,
      amount: Number(w.amount),
      status: w.status,
      requestedAt: w.requestedAt,
      processedAt: w.processedAt,
      bankName: w.bankName,
      last4: w.accountLast4,
      failureReason: w.failureReason,
    })),
  });
}
