import Link from "next/link";
import { prisma } from "@zyntomax/db";
import { requireSession, accessibleSiteIds, hasRole } from "@/lib/auth";
import {
  PageHeader, Card, Badge, statusTone, Table, formatNaira, buttonClass,
} from "@/components/ui";
import { createPayrollRun } from "./actions";
import { PayForm } from "./pay-form";
import { startOfWeek } from "date-fns";

export default async function PayrollPage() {
  const session = await requireSession();
  const siteIds = accessibleSiteIds(session);
  const isFinance = hasRole(session, ["FINANCE_ADMIN", "HR_ADMIN"]);

  const [runs, sites] = await Promise.all([
    prisma.payrollRun.findMany({
      where: siteIds ? { siteId: { in: siteIds } } : {},
      include: {
        site: true,
        items: {
          include: { staff: { include: { user: true } } },
          orderBy: { netAmount: "desc" },
        },
      },
      orderBy: { weekStart: "desc" },
      take: 8,
    }),
    prisma.site.findMany({
      where: { active: true, ...(siteIds ? { id: { in: siteIds } } : {}) },
    }),
  ]);

  const thisWeek = startOfWeek(new Date(), { weekStartsOn: 1 });
  const sitesWithoutRun = sites.filter(
    (s) => !runs.some((r) => r.siteId === s.id && r.weekStart.getTime() === thisWeek.getTime()),
  );

  return (
    <div>
      <PageHeader
        title="Payroll"
        subtitle="Weekly piece-rate wages: good output kg × rate per stage & material. Advances deduct automatically."
      />

      {isFinance && sitesWithoutRun.length > 0 && (
        <Card className="mb-4">
          <p className="mb-2 text-sm">
            Open this week&apos;s payroll run (week of{" "}
            {thisWeek.toLocaleDateString("en-NG", { day: "numeric", month: "long" })}):
          </p>
          <div className="flex flex-wrap gap-2">
            {sitesWithoutRun.map((s) => (
              <form key={s.id} action={createPayrollRun.bind(null, s.id)}>
                <button type="submit" className={buttonClass}>
                  Open run — {s.name}
                </button>
              </form>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            Opening a run tallies all completed jobs not yet on a payroll and locks them in.
          </p>
        </Card>
      )}

      {runs.length === 0 && (
        <Card>
          <p className="py-6 text-center text-sm text-muted">
            No payroll runs yet. Complete some production jobs, then open the week&apos;s run.
          </p>
        </Card>
      )}

      {runs.map((run) => {
        const totalNet = run.items.reduce((s, i) => s + Number(i.netAmount), 0);
        const totalEarned = run.items.reduce((s, i) => s + Number(i.earnedAmount), 0);
        return (
          <Card key={run.id} className="mb-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">
                  Week of {run.weekStart.toLocaleDateString("en-NG", { day: "numeric", month: "long", year: "numeric" })}
                  {sites.length > 1 && ` — ${run.site.name}`}
                </p>
                <p className="tabular text-sm text-muted">
                  {run.items.length} staff · earned {formatNaira(totalEarned)} · net {formatNaira(totalNet)}
                </p>
              </div>
              <Badge tone={statusTone(run.status)}>{run.status}</Badge>
            </div>
            {run.items.length === 0 ? (
              <p className="py-3 text-center text-sm text-muted">
                No wages this week (no completed jobs).
              </p>
            ) : (
              <Table headers={["Staff", "Commission", "Base", "Advance", "Discrepancy", "Net pay", "Payment"]}>
                {run.items.map((i) => (
                  <tr key={i.id}>
                    <td className="px-3 py-2">
                      <Link href={`/staff/${i.staffId}`} className="hover:underline">
                        {i.staff.user.name}
                      </Link>
                      <span className="tabular ml-1 text-xs text-muted">{i.staff.staffNo}</span>
                    </td>
                    <td className="tabular px-3 py-2">{formatNaira(Number(i.commissionAmount))}</td>
                    <td className="tabular px-3 py-2">{Number(i.baseAmount) > 0 ? formatNaira(Number(i.baseAmount)) : "—"}</td>
                    <td className="tabular px-3 py-2 text-warning">
                      {Number(i.advanceDeduction) > 0 ? `−${formatNaira(Number(i.advanceDeduction))}` : "—"}
                    </td>
                    <td className="tabular px-3 py-2 text-destructive">
                      {Number(i.discrepancyDeduction) > 0 ? `−${formatNaira(Number(i.discrepancyDeduction))}` : "—"}
                    </td>
                    <td className="tabular px-3 py-2 font-medium">{formatNaira(Number(i.netAmount))}</td>
                    <td className="px-3 py-2">
                      {i.paidAt ? (
                        <Badge tone="success">
                          Paid{i.paymentRef && i.paymentRef !== "manual" ? ` · ${i.paymentRef}` : ""}
                        </Badge>
                      ) : isFinance ? (
                        <PayForm itemId={i.id} />
                      ) : (
                        <Badge tone="warning">Unpaid</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>
        );
      })}
    </div>
  );
}
