"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { approveWithdrawalById, rejectWithdrawalById } from "@/lib/withdrawals";

/** Approve a withdrawal and send the Paystack transfer (shared with instant auto-pay). */
export async function approveWithdrawal(id: string): Promise<void> {
  const session = await requireRole(["FINANCE_ADMIN"]);
  await approveWithdrawalById(id, session.userId);
  revalidatePath("/withdrawals");
}

/** Reject a withdrawal — frees the vendor's balance. */
export async function rejectWithdrawal(id: string): Promise<void> {
  const session = await requireRole(["FINANCE_ADMIN"]);
  await rejectWithdrawalById(id, session.userId);
  revalidatePath("/withdrawals");
}
