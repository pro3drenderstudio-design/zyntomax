"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@zyntomax/db";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getSetting } from "@/lib/settings";
import { computeEarnings } from "@/lib/wages";
import { startOfWeek, addWeeks } from "date-fns";

export type FormState = { error?: string };

/**
 * Opens the payroll run for the current week: tallies every un-payrolled
 * completed job, applies advance deductions (capped), and locks the jobs in.
 */
export async function createPayrollRun(siteId: string): Promise<void> {
  const session = await requireRole(["FINANCE_ADMIN", "HR_ADMIN"]);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = addWeeks(weekStart, 1);

  const existing = await prisma.payrollRun.findUnique({
    where: { siteId_weekStart: { siteId, weekStart } },
  });
  if (existing) return;

  const earnings = await computeEarnings(siteId, weekStart, weekEnd);
  const capPct = await getSetting<number>("payroll.advance_cap_pct", 50, siteId);

  await prisma.$transaction(async (tx) => {
    const run = await tx.payrollRun.create({
      data: { siteId, weekStart, weekEnd },
    });

    for (const e of earnings) {
      // Outstanding advances, oldest first
      const advances = await tx.salaryAdvance.findMany({
        where: { staffId: e.staffId },
        orderBy: { createdAt: "asc" },
      });
      let deductible = (e.amount * capPct) / 100;
      let deducted = 0;
      for (const adv of advances) {
        const outstanding = Number(adv.amount) - Number(adv.repaidAmount);
        if (outstanding <= 0 || deductible <= 0) continue;
        const perAdvanceCap = adv.weeklyDeductionCap
          ? Number(adv.weeklyDeductionCap)
          : Infinity;
        const take = Math.min(outstanding, deductible, perAdvanceCap);
        if (take <= 0) continue;
        await tx.salaryAdvance.update({
          where: { id: adv.id },
          data: { repaidAmount: Number(adv.repaidAmount) + take },
        });
        deducted += take;
        deductible -= take;
      }

      await tx.payrollItem.create({
        data: {
          runId: run.id,
          staffId: e.staffId,
          earnedAmount: Math.round(e.amount * 100) / 100,
          advanceDeduction: Math.round(deducted * 100) / 100,
          netAmount: Math.round((e.amount - deducted) * 100) / 100,
        },
      });
      await tx.job.updateMany({
        where: { id: { in: e.jobIds } },
        data: { payrollRunId: run.id },
      });
    }
  });

  await audit({
    actorId: session.userId,
    action: "payroll.open",
    entity: "PayrollRun",
    entityId: `${siteId}:${weekStart.toISOString()}`,
    after: { staff: earnings.length },
  });

  revalidatePath("/payroll");
}

export async function markItemPaid(itemId: string, formData: FormData): Promise<void> {
  const session = await requireRole(["FINANCE_ADMIN"]);
  const ref = String(formData.get("paymentRef") ?? "").trim();

  const item = await prisma.payrollItem.update({
    where: { id: itemId },
    data: { paidAt: new Date(), paymentRef: ref || "manual" },
    include: { run: true },
  });

  // Roll the run status up when every item is paid
  const unpaid = await prisma.payrollItem.count({
    where: { runId: item.runId, paidAt: null },
  });
  await prisma.payrollRun.update({
    where: { id: item.runId },
    data: { status: unpaid === 0 ? "PAID" : "CLOSED", closedBy: session.userId },
  });

  await audit({
    actorId: session.userId,
    action: "payroll.pay_item",
    entity: "PayrollItem",
    entityId: itemId,
    after: { ref },
  });

  revalidatePath("/payroll");
}
