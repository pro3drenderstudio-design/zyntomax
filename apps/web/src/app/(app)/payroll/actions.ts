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
/**
 * Open (or refresh) this week's payroll run: tallies every completed job not
 * yet on a payroll and appends it to the run, creating a line for each staff
 * member or topping up an existing line. Safe to run repeatedly as more work
 * is completed during the week.
 */
export async function createPayrollRun(siteId: string): Promise<void> {
  const session = await requireRole(["FINANCE_ADMIN", "HR_ADMIN"]);

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = addWeeks(weekStart, 1);

  const earnings = await computeEarnings(siteId);
  const capPct = await getSetting<number>("payroll.advance_cap_pct", 50, siteId);
  const round = (n: number) => Math.round(n * 100) / 100;

  await prisma.$transaction(async (tx) => {
    const run =
      (await tx.payrollRun.findUnique({ where: { siteId_weekStart: { siteId, weekStart } } })) ??
      (await tx.payrollRun.create({ data: { siteId, weekStart, weekEnd } }));

    const existingItems = await tx.payrollItem.findMany({ where: { runId: run.id } });
    const itemByStaff = new Map(existingItems.map((i) => [i.staffId, i]));
    let touched = false;

    for (const e of earnings) {
      const existing = itemByStaff.get(e.staffId);

      if (existing) {
        // Top up an existing line with newly-completed commission (base and
        // deductions were applied when the line was first created).
        if (e.commissionAmount > 0) {
          const commissionAmount = round(Number(existing.commissionAmount) + e.commissionAmount);
          const earnedAmount = round(commissionAmount + Number(existing.baseAmount));
          await tx.payrollItem.update({
            where: { id: existing.id },
            data: {
              commissionAmount,
              earnedAmount,
              netAmount: round(earnedAmount - Number(existing.advanceDeduction) - Number(existing.discrepancyDeduction)),
              paidAt: null,
              paymentRef: null,
            },
          });
          touched = true;
        }
        if (e.jobIds.length) {
          await tx.job.updateMany({ where: { id: { in: e.jobIds } }, data: { payrollRunId: run.id } });
        }
        continue;
      }

      // New line for this staff member: commission + base, less advances & charges
      const earned = e.commissionAmount + e.baseAmount;

      const advances = await tx.salaryAdvance.findMany({
        where: { staffId: e.staffId },
        orderBy: { createdAt: "asc" },
      });
      let deductible = (earned * capPct) / 100;
      let deducted = 0;
      for (const adv of advances) {
        const outstanding = Number(adv.amount) - Number(adv.repaidAmount);
        if (outstanding <= 0 || deductible <= 0) continue;
        const perAdvanceCap = adv.weeklyDeductionCap ? Number(adv.weeklyDeductionCap) : Infinity;
        const take = Math.min(outstanding, deductible, perAdvanceCap);
        if (take <= 0) continue;
        await tx.salaryAdvance.update({
          where: { id: adv.id },
          data: { repaidAmount: Number(adv.repaidAmount) + take },
        });
        deducted += take;
        deductible -= take;
      }

      const chargeAgg = await tx.discrepancyCharge.aggregate({
        _sum: { amount: true },
        where: { staffId: e.staffId, payrollItemId: null },
      });
      const discrepancyDeduction = Math.min(
        Number(chargeAgg._sum.amount ?? 0),
        Math.max(0, earned - deducted),
      );

      const item = await tx.payrollItem.create({
        data: {
          runId: run.id,
          staffId: e.staffId,
          commissionAmount: round(e.commissionAmount),
          baseAmount: round(e.baseAmount),
          earnedAmount: round(earned),
          advanceDeduction: round(deducted),
          discrepancyDeduction: round(discrepancyDeduction),
          netAmount: round(earned - deducted - discrepancyDeduction),
        },
      });
      if (discrepancyDeduction > 0) {
        await tx.discrepancyCharge.updateMany({
          where: { staffId: e.staffId, payrollItemId: null },
          data: { payrollItemId: item.id },
        });
      }
      if (e.jobIds.length) {
        await tx.job.updateMany({ where: { id: { in: e.jobIds } }, data: { payrollRunId: run.id } });
      }
      touched = true;
    }

    // If new work was added to a previously-closed run, reopen it
    if (touched && run.status !== "OPEN") {
      await tx.payrollRun.update({ where: { id: run.id }, data: { status: "OPEN" } });
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
