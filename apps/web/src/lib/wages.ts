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
  commissionAmount: number;
  baseAmount: number;
  jobIds: string[];
};

/**
 * Full weekly earnings per staff, honouring each staff member's wage model:
 *  - COMMISSION: piece-rate on good output only
 *  - SALARY: weekly base only (no commission)
 *  - COMMISSION_PLUS_BASE: piece-rate + weekly base
 * A stage's rate card can be based on scale-in or scale-out (see rateBasisKg).
 */
export async function computeEarnings(
  siteId: string,
  from: Date,
  to: Date,
): Promise<StaffEarning[]> {
  const perStaff = new Map<string, StaffEarning>();
  const ensure = (id: string) => {
    let cur = perStaff.get(id);
    if (!cur) {
      cur = { staffId: id, commissionAmount: 0, baseAmount: 0, jobIds: [] };
      perStaff.set(id, cur);
    }
    return cur;
  };

  // Wage models for staff in scope
  const staffProfiles = await prisma.staffProfile.findMany({
    where: {
      user: {
        status: "ACTIVE",
        roles: { some: { OR: [{ siteId }, { siteId: null }] } },
      },
    },
    select: { id: true, wageModel: true, baseSalaryWeekly: true },
  });
  const wageOf = new Map(staffProfiles.map((s) => [s.id, s]));

  // Commission from completed jobs not yet on a payroll
  const jobs = await prisma.job.findMany({
    where: {
      siteId,
      status: { in: ["COMPLETED", "RESOLVED"] },
      payrollRunId: null,
      completedAt: { gte: from, lt: to },
    },
    include: { assignments: true, stage: true },
  });

  for (const job of jobs) {
    // Pay basis: crushers on scale-out, sorters on scale-in (per stage).
    const basisKg =
      job.stage.payBasis === "SCALE_IN"
        ? Number(job.weightInKg)
        : Number(job.weightOutKg ?? 0);
    if (basisKg <= 0) continue;
    const rate = await rateFor(job.stageId, job.materialTypeId, job.completedAt ?? new Date(), job.siteId);
    if (rate === null) continue;
    const jobWage = basisKg * rate;
    for (const a of job.assignments) {
      const model = wageOf.get(a.staffId)?.wageModel ?? "COMMISSION";
      const cur = ensure(a.staffId);
      cur.jobIds.push(job.id);
      // Salaried staff don't earn commission
      if (model !== "SALARY") cur.commissionAmount += jobWage * Number(a.share);
    }
  }

  // Weekly base for salaried / commission+base staff (once per week)
  for (const s of staffProfiles) {
    if (s.wageModel === "COMMISSION") continue;
    const base = Number(s.baseSalaryWeekly ?? 0);
    if (base <= 0) continue;
    ensure(s.id).baseAmount += base;
  }

  // Only include staff who actually earned something this week
  return [...perStaff.values()].filter(
    (e) => e.commissionAmount > 0 || e.baseAmount > 0,
  );
}
