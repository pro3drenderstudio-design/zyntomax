import { prisma } from "@zyntomax/db";
import { startOfWeek, addWeeks } from "date-fns";
import { audit } from "@/lib/audit";
import { getSetting } from "@/lib/settings";
import { computeEarnings } from "@/lib/wages";

const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Open (or refresh) this week's payroll run for a site: tally every completed
 * job not yet on a payroll, apply capped advance deductions and unsettled
 * discrepancy charges, and lock the jobs in. Safe to run repeatedly. Shared by
 * the web action and the mobile API; audits internally.
 */
export async function openPayrollRun(siteId: string, actorId: string): Promise<{ staff: number }> {
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekEnd = addWeeks(weekStart, 1);

  const earnings = await computeEarnings(siteId);
  const capPct = await getSetting<number>("payroll.advance_cap_pct", 50, siteId);

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

      const earned = e.commissionAmount + e.baseAmount;

      const advances = await tx.salaryAdvance.findMany({ where: { staffId: e.staffId }, orderBy: { createdAt: "asc" } });
      let deductible = (earned * capPct) / 100;
      let deducted = 0;
      for (const adv of advances) {
        const outstanding = Number(adv.amount) - Number(adv.repaidAmount);
        if (outstanding <= 0 || deductible <= 0) continue;
        const perAdvanceCap = adv.weeklyDeductionCap ? Number(adv.weeklyDeductionCap) : Infinity;
        const take = Math.min(outstanding, deductible, perAdvanceCap);
        if (take <= 0) continue;
        await tx.salaryAdvance.update({ where: { id: adv.id }, data: { repaidAmount: Number(adv.repaidAmount) + take } });
        deducted += take;
        deductible -= take;
      }

      const chargeAgg = await tx.discrepancyCharge.aggregate({
        _sum: { amount: true },
        where: { staffId: e.staffId, payrollItemId: null },
      });
      const discrepancyDeduction = Math.min(Number(chargeAgg._sum.amount ?? 0), Math.max(0, earned - deducted));

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
        await tx.discrepancyCharge.updateMany({ where: { staffId: e.staffId, payrollItemId: null }, data: { payrollItemId: item.id } });
      }
      if (e.jobIds.length) {
        await tx.job.updateMany({ where: { id: { in: e.jobIds } }, data: { payrollRunId: run.id } });
      }
      touched = true;
    }

    if (touched && run.status !== "OPEN") {
      await tx.payrollRun.update({ where: { id: run.id }, data: { status: "OPEN" } });
    }
  });

  await audit({
    actorId,
    action: "payroll.open",
    entity: "PayrollRun",
    entityId: `${siteId}:${weekStart.toISOString()}`,
    after: { staff: earnings.length },
  });

  return { staff: earnings.length };
}

/** Mark a payroll line paid and roll the run status up. Shared; audits internally. */
export async function payPayrollItem(itemId: string, actorId: string, ref?: string): Promise<void> {
  const paymentRef = (ref ?? "").trim() || "manual";
  const item = await prisma.payrollItem.update({
    where: { id: itemId },
    data: { paidAt: new Date(), paymentRef },
    include: { run: true },
  });

  const unpaid = await prisma.payrollItem.count({ where: { runId: item.runId, paidAt: null } });
  await prisma.payrollRun.update({
    where: { id: item.runId },
    data: { status: unpaid === 0 ? "PAID" : "CLOSED", closedBy: actorId },
  });

  await audit({ actorId, action: "payroll.pay_item", entity: "PayrollItem", entityId: itemId, after: { ref: paymentRef } });
}
