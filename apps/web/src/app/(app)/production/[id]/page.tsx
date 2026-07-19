import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@zyntomax/db";
import { requireSession } from "@/lib/auth";
import {
  PageHeader, Card, Badge, statusTone, Table, StatCard, formatKg, formatNaira,
} from "@/components/ui";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      stage: true,
      materialType: true,
      site: true,
      assignments: { include: { staff: { include: { user: true } } } },
      outputs: { include: { stageOutput: true } },
      discrepancyCharges: { include: { staff: { include: { user: true } } } },
      payrollRun: { include: { items: true } },
    },
  });
  if (!job) notFound();

  const weightIn = Number(job.weightInKg);
  const weightOut = Number(job.weightOutKg ?? 0);
  const waste = Number(job.wasteKg ?? 0);
  const discrepancy = weightIn - weightOut - waste;
  const discrepancyPct = weightIn > 0 ? (discrepancy / weightIn) * 100 : 0;

  // Payment: when the assigned staff were paid for this job's payroll run
  const paidItem = job.payrollRun?.items.find((i) =>
    job.assignments.some((a) => a.staffId === i.staffId) && i.paidAt,
  );

  const fmt = (d: Date | null) =>
    d ? d.toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

  return (
    <div>
      <PageHeader
        title={`${job.stage.name} — ${job.materialType.name}`}
        subtitle={`${job.site.name}${job.lotNo ? ` · lot ${job.lotNo}` : ""}`}
        action={<Badge tone={statusTone(job.status)}>{job.status}</Badge>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Scaled in" value={formatKg(weightIn)} />
        <StatCard label="Good output" value={formatKg(weightOut)} tone="accent" />
        <StatCard label="Waste" value={formatKg(waste)} />
        <StatCard
          label="Discrepancy"
          value={`${discrepancyPct.toFixed(1)}%`}
          hint={formatKg(discrepancy)}
          tone={Math.abs(discrepancyPct) > Number(job.toleranceSnapshot) ? "destructive" : "default"}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-sm font-medium">Timeline</h2>
          <dl className="grid grid-cols-[130px_1fr] gap-x-2 gap-y-1.5 text-sm">
            <dt className="text-muted">Started</dt><dd>{fmt(job.startedAt)}</dd>
            <dt className="text-muted">Completed</dt><dd>{fmt(job.completedAt)}</dd>
            <dt className="text-muted">Tolerance</dt><dd>±{Number(job.toleranceSnapshot)}%</dd>
            <dt className="text-muted">Pay basis</dt><dd>{job.stage.payBasis === "SCALE_IN" ? "Scale-in weight" : "Good output"}</dd>
            <dt className="text-muted">Payroll</dt>
            <dd>
              {job.payrollRun ? (
                <span className="inline-flex items-center gap-1.5">
                  <Link href="/payroll" className="text-accent hover:underline">
                    Week of {job.payrollRun.weekStart.toLocaleDateString("en-NG")}
                  </Link>
                  <Badge tone={statusTone(job.payrollRun.status)}>{job.payrollRun.status}</Badge>
                </span>
              ) : "Not yet on a payroll"}
            </dd>
            <dt className="text-muted">Paid</dt><dd>{paidItem ? fmt(paidItem.paidAt) : "Not paid"}</dd>
          </dl>
          {job.flagReason && (
            <p className="mt-3 rounded-md bg-warning-soft px-3 py-2 text-sm text-warning">{job.flagReason}</p>
          )}
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-medium">Assigned staff</h2>
          {job.assignments.length === 0 ? (
            <p className="text-sm text-muted">No staff assigned.</p>
          ) : (
            <ul className="flex flex-col gap-1.5 text-sm">
              {job.assignments.map((a) => (
                <li key={a.id} className="flex items-center justify-between">
                  <Link href={`/staff/${a.staffId}`} className="hover:underline">{a.staff.user.name}</Link>
                  <span className="text-muted">{(Number(a.share) * 100).toFixed(0)}% share</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {job.outputs.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 font-medium">Output materials</h2>
          <Table headers={["Output", "Weight", "Share of output"]}>
            {job.outputs.map((o) => (
              <tr key={o.id}>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full border border-border" style={{ backgroundColor: o.stageOutput.color ?? "#cbd5e1" }} aria-hidden />
                    {o.stageOutput.name}
                  </span>
                </td>
                <td className="tabular px-3 py-2 font-medium">{formatKg(Number(o.weightKg))}</td>
                <td className="tabular px-3 py-2 text-muted">
                  {weightOut > 0 ? `${((Number(o.weightKg) / weightOut) * 100).toFixed(0)}%` : "—"}
                </td>
              </tr>
            ))}
          </Table>
        </>
      )}

      {job.discrepancyCharges.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 font-medium">Discrepancy charge-backs</h2>
          <Table headers={["Staff", "Amount", "Reason", "Settled"]}>
            {job.discrepancyCharges.map((c) => (
              <tr key={c.id}>
                <td className="px-3 py-2">{c.staff.user.name}</td>
                <td className="tabular px-3 py-2 text-destructive">−{formatNaira(Number(c.amount))}</td>
                <td className="px-3 py-2 text-muted">{c.reason ?? "—"}</td>
                <td className="px-3 py-2">{c.payrollItemId ? <Badge tone="success">On payslip</Badge> : <Badge tone="warning">Pending</Badge>}</td>
              </tr>
            ))}
          </Table>
        </>
      )}
    </div>
  );
}
