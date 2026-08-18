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
 * Outstanding earnings per staff, honouring each staff member's wage model:
 *  - COMMISSION: piece-rate on good output only
 *  - SALARY: weekly base only (no commission)
 *  - COMMISSION_PLUS_BASE: piece-rate + weekly base
 * A stage's rate card can be based on scale-in or scale-out.
 *
 * Commission covers ALL completed jobs not yet stamped onto a payroll run
 * (not just this week's) so nothing falls through the cracks. Base salary is
 * emitted for eligible staff; the payroll run applies it once per run.
 */
export async function computeEarnings(siteId: string): Promise<StaffEarning[]> {
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

  // Commission from every completed job not yet on a payroll run
  const jobs = await prisma.job.findMany({
    where: {
      siteId,
      status: { in: ["COMPLETED", "RESOLVED"] },
      payrollRunId: null,
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

export type StaffLiveEarnings = {
  wageModel: string;
  commissionAmount: number;
  baseAmount: number;
  earnedAmount: number;
  jobCount: number;
  jobs: { id: string; stage: string; material: string; basisKg: number; wage: number; completedAt: Date | null }[];
};

/**
 * One staff member's outstanding (un-payrolled) earnings across all their jobs,
 * using the same piece-rate + wage-model math as computeEarnings. Powers the
 * "my earnings this period" view; the payroll run still applies deductions.
 */
export async function computeStaffEarnings(staffId: string): Promise<StaffLiveEarnings> {
  const staff = await prisma.staffProfile.findUnique({
    where: { id: staffId },
    select: { wageModel: true, baseSalaryWeekly: true },
  });
  const wageModel = staff?.wageModel ?? "COMMISSION";

  const jobs = await prisma.job.findMany({
    where: {
      status: { in: ["COMPLETED", "RESOLVED"] },
      payrollRunId: null,
      assignments: { some: { staffId } },
    },
    include: { assignments: true, stage: true, materialType: true },
  });

  let commissionAmount = 0;
  const detail: StaffLiveEarnings["jobs"] = [];
  for (const job of jobs) {
    const basisKg =
      job.stage.payBasis === "SCALE_IN" ? Number(job.weightInKg) : Number(job.weightOutKg ?? 0);
    if (basisKg <= 0) continue;
    const rate = await rateFor(job.stageId, job.materialTypeId, job.completedAt ?? new Date(), job.siteId);
    if (rate === null) continue;
    const mine = job.assignments.find((a) => a.staffId === staffId);
    const share = mine ? Number(mine.share) : 0;
    const wage = wageModel === "SALARY" ? 0 : basisKg * rate * share;
    commissionAmount += wage;
    detail.push({ id: job.id, stage: job.stage.name, material: job.materialType.name, basisKg, wage, completedAt: job.completedAt });
  }

  const baseAmount = wageModel === "COMMISSION" ? 0 : Number(staff?.baseSalaryWeekly ?? 0);
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    wageModel,
    commissionAmount: round(commissionAmount),
    baseAmount: round(baseAmount),
    earnedAmount: round(commissionAmount + baseAmount),
    jobCount: detail.length,
    jobs: detail,
  };
}
