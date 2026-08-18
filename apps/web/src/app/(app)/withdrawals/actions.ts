"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@zyntomax/db";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { isSimulated } from "@/lib/paystack";
import { sendSms } from "@/lib/sms";
import { companyFloat, payWithdrawal } from "@/lib/withdrawals";

/** Approve a withdrawal and send the Paystack transfer (shared with instant auto-pay). */
export async function approveWithdrawal(id: string): Promise<void> {
  const session = await requireRole(["FINANCE_ADMIN"]);
  const w = await prisma.withdrawal.findUniqueOrThrow({ where: { id } });
  if (w.status !== "PENDING") return;

  if (!isSimulated() && (await companyFloat()) < Number(w.amount)) {
    await prisma.withdrawal.update({ where: { id }, data: { failureReason: "Insufficient wallet funds — top up first" } });
    revalidatePath("/withdrawals");
    return;
  }

  const res = await payWithdrawal(id, session.userId);
  await audit({ actorId: session.userId, action: "withdrawal.approve", entity: "Withdrawal", entityId: id, after: { status: res.status } });
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
