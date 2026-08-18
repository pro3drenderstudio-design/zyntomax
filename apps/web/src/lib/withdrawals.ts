import { prisma } from "@zyntomax/db";
import { initiateTransfer, isSimulated } from "@/lib/paystack";
import { sendSms } from "@/lib/sms";
import { sendExpoPush } from "@/lib/push";

/** Company Paystack float (append-only WalletTransaction ledger). */
export async function companyFloat(): Promise<number> {
  const agg = await prisma.walletTransaction.aggregate({ _sum: { amount: true } });
  return Number(agg._sum.amount ?? 0);
}

/**
 * Execute the Paystack transfer for a withdrawal and mark it PAID/APPROVED/FAILED.
 * Shared by instant auto-approval (vendor request) and admin approval, so both
 * paths behave identically and write the same company ledger entry.
 */
export async function payWithdrawal(
  withdrawalId: string,
  processedById: string | null,
): Promise<{ ok: boolean; status: string; error?: string }> {
  const w = await prisma.withdrawal.findUniqueOrThrow({ where: { id: withdrawalId }, include: { vendor: true } });
  if (w.status === "PAID") return { ok: true, status: "PAID" };
  if (!w.vendor.paystackRecipient && !isSimulated()) {
    await prisma.withdrawal.update({ where: { id: withdrawalId }, data: { status: "FAILED", failureReason: "No verified bank account", processedById, processedAt: new Date() } });
    return { ok: false, status: "FAILED", error: "No verified bank account" };
  }
  try {
    const transfer = await initiateTransfer({
      amountNaira: Number(w.amount),
      recipientCode: w.vendor.paystackRecipient ?? "sim",
      reference: w.idempotencyKey,
      reason: "Zyntomax wallet withdrawal",
    });
    const status = transfer.status === "success" ? "PAID" : "APPROVED";
    await prisma.$transaction([
      prisma.withdrawal.update({ where: { id: withdrawalId }, data: { status, paystackRef: transfer.transfer_code, failureReason: null, processedById, processedAt: new Date() } }),
      prisma.walletTransaction.create({ data: { kind: "PAYOUT", amount: -Number(w.amount), paystackRef: transfer.transfer_code, note: `Withdrawal to ${w.vendor.name}` } }),
    ]);
    await sendSms({ to: w.vendor.phone, vendorId: w.vendorId, body: `Zyntomax: your withdrawal of ₦${Number(w.amount).toLocaleString("en-NG")} has been paid to your bank. Thank you!` });
    await sendExpoPush(w.vendor.pushToken, "Payment sent 💸", `Your withdrawal of ₦${Number(w.amount).toLocaleString("en-NG")} has been paid to your bank.`, { screen: "wallet" });
    return { ok: true, status };
  } catch (e) {
    await prisma.withdrawal.update({ where: { id: withdrawalId }, data: { status: "FAILED", failureReason: e instanceof Error ? e.message : "Transfer failed", processedById, processedAt: new Date() } });
    return { ok: false, status: "FAILED", error: e instanceof Error ? e.message : "Transfer failed" };
  }
}
