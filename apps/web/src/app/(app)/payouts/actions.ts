"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@zyntomax/db";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { initiateTransfer, isSimulated } from "@/lib/paystack";
import { sendSms } from "@/lib/sms";

export type FormState = { error?: string; ok?: string };

export async function walletBalance(): Promise<number> {
  const agg = await prisma.walletTransaction.aggregate({ _sum: { amount: true } });
  return Number(agg._sum.amount ?? 0);
}

export async function topUpWallet(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["FINANCE_ADMIN"]);
  const amount = Number(formData.get("amount"));
  const reference = String(formData.get("reference") ?? "").trim();
  if (!amount || amount <= 0) return { error: "Enter a valid top-up amount." };

  await prisma.walletTransaction.create({
    data: {
      kind: "TOPUP",
      amount,
      paystackRef: reference || undefined,
      note: `Top-up recorded by finance`,
    },
  });
  await audit({
    actorId: session.userId,
    action: "wallet.topup",
    entity: "WalletTransaction",
    entityId: reference || "manual",
    after: { amount },
  });
  revalidatePath("/payouts");
  revalidatePath("/wallet");
  return { ok: "Top-up recorded." };
}

export async function releaseBatch(batchId: string): Promise<void> {
  const session = await requireRole(["FINANCE_ADMIN"]);

  const batch = await prisma.payoutBatch.findUniqueOrThrow({
    where: { id: batchId },
    include: {
      payouts: { include: { vendor: true } },
      trip: { include: { locality: true } },
    },
  });
  if (["COMPLETED", "PROCESSING"].includes(batch.status)) return;

  const pending = batch.payouts.filter((p) =>
    ["PENDING", "FAILED"].includes(p.status),
  );
  const required = pending.reduce((s, p) => s + Number(p.amount), 0);

  // Wallet check — internal ledger is the source of truth (mirrors Paystack)
  const balance = await walletBalance();
  if (balance < required) {
    await prisma.payoutBatch.update({
      where: { id: batchId },
      data: { status: "AWAITING_FUNDS" },
    });
    revalidatePath("/payouts");
    return;
  }

  await prisma.payoutBatch.update({
    where: { id: batchId },
    data: { status: "PROCESSING" },
  });

  let failures = 0;
  for (const payout of pending) {
    const vendor = payout.vendor;
    if (!vendor.paystackRecipient && !isSimulated()) {
      await prisma.payout.update({
        where: { id: payout.id },
        data: { status: "FAILED", failureReason: "No verified bank account" },
      });
      failures++;
      continue;
    }
    try {
      const transfer = await initiateTransfer({
        amountNaira: Number(payout.amount),
        recipientCode: vendor.paystackRecipient ?? "sim",
        reference: payout.idempotencyKey,
        reason: `Zyntomax recyclables — ${batch.trip.locality?.name ?? "collection"}`,
      });
      await prisma.$transaction([
        prisma.payout.update({
          where: { id: payout.id },
          data: {
            status: transfer.status === "success" ? "SUCCESS" : "PROCESSING",
            paystackRef: transfer.transfer_code,
            failureReason: null,
          },
        }),
        prisma.walletTransaction.create({
          data: {
            kind: "PAYOUT",
            amount: -Number(payout.amount),
            paystackRef: transfer.transfer_code,
            note: `Payout to ${vendor.name}`,
          },
        }),
      ]);
      await sendSms({
        to: vendor.phone,
        vendorId: vendor.id,
        body: `Zyntomax: You have been paid ₦${Number(payout.amount).toLocaleString("en-NG")} for your recyclables. Thank you!`,
      });
    } catch (e) {
      failures++;
      await prisma.payout.update({
        where: { id: payout.id },
        data: {
          status: "FAILED",
          failureReason: e instanceof Error ? e.message : "Transfer failed",
        },
      });
    }
  }

  const finalStatus = failures === 0 ? "COMPLETED" : "PARTIAL_FAILED";
  await prisma.$transaction([
    prisma.payoutBatch.update({
      where: { id: batchId },
      data: {
        status: finalStatus,
        releasedBy: session.userId,
        releasedAt: new Date(),
      },
    }),
    ...(failures === 0
      ? [prisma.trip.update({ where: { id: batch.tripId }, data: { status: "PAID" } })]
      : []),
  ]);

  await audit({
    actorId: session.userId,
    action: "payout.release",
    entity: "PayoutBatch",
    entityId: batchId,
    after: { released: pending.length - failures, failed: failures },
  });

  revalidatePath("/payouts");
}
