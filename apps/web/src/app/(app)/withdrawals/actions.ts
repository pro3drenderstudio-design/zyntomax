"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@zyntomax/db";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { initiateTransfer, isSimulated } from "@/lib/paystack";
import { sendSms } from "@/lib/sms";

async function companyWalletBalance(): Promise<number> {
  const agg = await prisma.walletTransaction.aggregate({ _sum: { amount: true } });
  return Number(agg._sum.amount ?? 0);
}

/** Approve a withdrawal and send the Paystack transfer. */
export async function approveWithdrawal(id: string): Promise<void> {
  const session = await requireRole(["FINANCE_ADMIN"]);
  const w = await prisma.withdrawal.findUniqueOrThrow({ where: { id }, include: { vendor: true } });
  if (w.status !== "PENDING") return;

  if (!w.vendor.paystackRecipient && !isSimulated()) {
    await prisma.withdrawal.update({ where: { id }, data: { status: "FAILED", failureReason: "No verified bank account", processedById: session.userId, processedAt: new Date() } });
    revalidatePath("/withdrawals");
    return;
  }
  if (!isSimulated() && (await companyWalletBalance()) < Number(w.amount)) {
    await prisma.withdrawal.update({ where: { id }, data: { failureReason: "Insufficient wallet funds — top up first" } });
    revalidatePath("/withdrawals");
    return;
  }

  try {
    const transfer = await initiateTransfer({
      amountNaira: Number(w.amount),
      recipientCode: w.vendor.paystackRecipient ?? "sim",
      reference: w.idempotencyKey,
      reason: "Zyntomax wallet withdrawal",
    });
    await prisma.$transaction([
      prisma.withdrawal.update({
        where: { id },
        data: { status: transfer.status === "success" ? "PAID" : "APPROVED", paystackRef: transfer.transfer_code, failureReason: null, processedById: session.userId, processedAt: new Date() },
      }),
      prisma.walletTransaction.create({
        data: { kind: "PAYOUT", amount: -Number(w.amount), paystackRef: transfer.transfer_code, note: `Withdrawal to ${w.vendor.name}` },
      }),
    ]);
    await sendSms({ to: w.vendor.phone, vendorId: w.vendorId, body: `Zyntomax: your withdrawal of ₦${Number(w.amount).toLocaleString("en-NG")} has been paid to your bank. Thank you!` });
    await audit({ actorId: session.userId, action: "withdrawal.approve", entity: "Withdrawal", entityId: id, after: { amount: Number(w.amount) } });
  } catch (e) {
    await prisma.withdrawal.update({ where: { id }, data: { status: "FAILED", failureReason: e instanceof Error ? e.message : "Transfer failed", processedById: session.userId, processedAt: new Date() } });
  }
  revalidatePath("/withdrawals");
}

/** Reject a withdrawal — frees the vendor's balance. */
export async function rejectWithdrawal(id: string): Promise<void> {
  const session = await requireRole(["FINANCE_ADMIN"]);
  const w = await prisma.withdrawal.findUniqueOrThrow({ where: { id }, include: { vendor: true } });
  if (!["PENDING", "APPROVED"].includes(w.status)) return;
  await prisma.withdrawal.update({ where: { id }, data: { status: "REJECTED", processedById: session.userId, processedAt: new Date() } });
  await sendSms({ to: w.vendor.phone, vendorId: w.vendorId, body: `Zyntomax: your withdrawal request of ₦${Number(w.amount).toLocaleString("en-NG")} could not be processed. Please contact us.` });
  await audit({ actorId: session.userId, action: "withdrawal.reject", entity: "Withdrawal", entityId: id });
  revalidatePath("/withdrawals");
}
