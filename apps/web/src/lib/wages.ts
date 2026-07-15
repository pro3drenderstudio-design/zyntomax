import { prisma } from "@zyntomax/db";

/**
 * Piece-rate wage engine.
 * A completed job earns: good output kg × rate(stage, material, effective at completion),
 * split between assignees by their share. Paying on accepted output (not input)
 * keeps incentives aligned — rushing and inflating waste earns nothing.
 */

export async function rateFor(
  stageId: string,
  materialTypeId: string,
  at: Date,
  siteId?: string,
): Promise<number | null> {
  // Site-specific rate wins over the global default
  const rows = await prisma.rateCard.findMany({
    where: {
      stageId,
      materialTypeId,
      effectiveFrom: { lte: at },
      OR: [{ siteId: null }, ...(siteId ? [{ siteId }] : [])],
    },
    orderBy: { effectiveFrom: "desc" },
  });
  const siteRow = siteId ? rows.find((r) => r.siteId === siteId) : undefined;
  const globalRow = rows.find((r) => r.siteId === null);
  const row = siteRow ?? globalRow;
  return row ? Number(row.ratePerKg) : null;
}

export type StaffEarning = {
  staffId: string;
  amount: number;
  jobIds: string[];
};

/** Earnings per staff for un-payrolled jobs completed in [from, to). */
export async function computeEarnings(
  siteId: string,
  from: Date,
  to: Date,
): Promise<StaffEarning[]> {
  const jobs = await prisma.job.findMany({
    where: {
      siteId,
      status: { in: ["COMPLETED", "RESOLVED"] },
      payrollRunId: null,
      completedAt: { gte: from, lt: to },
    },
    include: { assignments: true },
  });

  const perStaff = new Map<string, StaffEarning>();
  for (const job of jobs) {
    const outKg = Number(job.weightOutKg ?? 0);
    if (outKg <= 0) continue;
    const rate = await rateFor(
      job.stageId,
      job.materialTypeId,
      job.completedAt ?? new Date(),
      job.siteId,
    );
    if (rate === null) continue;
    const jobWage = outKg * rate;
    for (const a of job.assignments) {
      const cur = perStaff.get(a.staffId) ?? { staffId: a.staffId, amount: 0, jobIds: [] };
      cur.amount += jobWage * Number(a.share);
      if (!cur.jobIds.includes(job.id)) cur.jobIds.push(job.id);
      perStaff.set(a.staffId, cur);
    }
  }
  return [...perStaff.values()];
}
