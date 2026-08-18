"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { openPayrollRun, payPayrollItem } from "@/lib/payroll";

export type FormState = { error?: string };

/**
 * Open (or refresh) this week's payroll run: tallies every completed job not
 * yet on a payroll and appends it, creating or topping up each staff line.
 * Safe to run repeatedly as more work is completed during the week.
 */
export async function createPayrollRun(siteId: string): Promise<void> {
  const session = await requireRole(["FINANCE_ADMIN", "HR_ADMIN"]);
  await openPayrollRun(siteId, session.userId);
  revalidatePath("/payroll");
}

export async function markItemPaid(itemId: string, formData: FormData): Promise<void> {
  const session = await requireRole(["FINANCE_ADMIN"]);
  await payPayrollItem(itemId, session.userId, String(formData.get("paymentRef") ?? ""));
  revalidatePath("/payroll");
}
