import { notFound } from "next/navigation";
import { prisma } from "@zyntomax/db";
import { requireSession, hasRole } from "@/lib/auth";
import {
  Card, Badge, statusTone, Table, StatCard, Avatar, formatNaira, formatKg,
} from "@/components/ui";
import { IssuanceForm, StaffLogForm, AdvanceForm } from "./hr-forms";
import { StaffAdmin } from "./staff-admin";
import { WageModelCard } from "./wage-model";

const LOG_TONE = { MEDICAL: "info", REWARD: "success", DISCIPLINARY: "destructive" } as const;

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const staff = await prisma.staffProfile.findUnique({
    where: { id },
    include: {
      user: { include: { roles: true } },
      issuances: { orderBy: { issuedAt: "desc" } },
      staffLogs: { orderBy: { createdAt: "desc" } },
      advances: { orderBy: { createdAt: "desc" } },
      payrollItems: {
        include: { run: true },
        orderBy: { run: { weekStart: "desc" } },
        take: 12,
      },
      jobAssignments: {
        include: { job: { include: { stage: true, materialType: true } } },
        orderBy: { job: { startedAt: "desc" } },
        take: 15,
      },
    },
  });
  if (!staff) notFound();

  const isHr = hasRole(session, ["HR_ADMIN", "OPERATIONS_MANAGER"]);
  const isFinance = hasRole(session, ["FINANCE_ADMIN", "HR_ADMIN"]);
  const isSuperAdmin = hasRole(session, []);

  const outstandingAdvance = staff.advances.reduce(
    (s, a) => s + Number(a.amount) - Number(a.repaidAmount),
    0,
  );
  const totalEarned = staff.payrollItems.reduce((s, i) => s + Number(i.earnedAmount), 0);
  const primaryRole = staff.user.roles[0]?.role.replace(/_/g, " ") ?? "Staff";

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={staff.user.name} url={staff.photoUrl} size={56} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold">{staff.user.name}</h1>
              <Badge tone={statusTone(staff.user.status)}>{staff.user.status}</Badge>
            </div>
            <p className="mt-0.5 text-sm text-muted">
              {staff.staffNo} · {primaryRole} · {staff.user.phone}
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {staff.user.roles.map((r) => (
                <Badge key={r.id} tone="neutral">{r.role.split("_").map((w) => w[0] + w.slice(1).toLowerCase()).join(" ")}</Badge>
              ))}
            </div>
          </div>
        </div>
        <StaffAdmin
          staffId={staff.id}
          status={staff.user.status}
          currentRoles={staff.user.roles.map((r) => r.role)}
          siteId={staff.user.roles[0]?.siteId ?? ""}
          canManage={isHr}
          isSuperAdmin={isSuperAdmin}
        />
      </div>

      <div className="flex flex-wrap items-start gap-4">
        <div className="grid min-w-64 flex-1 grid-cols-2 gap-3">
          <StatCard label="Earned (last 12 weeks)" value={formatNaira(totalEarned)} />
          <StatCard
            label="Outstanding advance"
            value={formatNaira(outstandingAdvance)}
            tone={outstandingAdvance > 0 ? "warning" : "default"}
          />
          <Card className="col-span-2">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <span className="text-muted">Bank</span>
              <span>{staff.bankName ?? "—"} {staff.bankAccountNo ? `· ${staff.bankAccountNo}` : ""}</span>
              <span className="text-muted">Address</span>
              <span>{staff.address ?? "—"}</span>
              <span className="text-muted">Next of kin</span>
              <span>{staff.nextOfKinName ?? "—"} {staff.nextOfKinPhone ? `· ${staff.nextOfKinPhone}` : ""}</span>
              <span className="text-muted">Emergency</span>
              <span>{staff.emergencyName ?? "—"} {staff.emergencyPhone ? `· ${staff.emergencyPhone}` : ""}</span>
            </div>
          </Card>
        </div>
      </div>

      {isSuperAdmin && (
        <div className="mt-4 max-w-md">
          <WageModelCard
            staffId={staff.id}
            wageModel={staff.wageModel}
            baseSalaryWeekly={staff.baseSalaryWeekly ? Number(staff.baseSalaryWeekly) : null}
          />
        </div>
      )}

      {/* Recent work */}
      {staff.jobAssignments.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 font-medium">Recent jobs</h2>
          <Table headers={["Date", "Stage", "Material", "In", "Out", "Share", "Status"]}>
            {staff.jobAssignments.map((a) => (
              <tr key={a.id}>
                <td className="px-3 py-2">{a.job.startedAt.toLocaleDateString("en-NG")}</td>
                <td className="px-3 py-2">{a.job.stage.name}</td>
                <td className="px-3 py-2">{a.job.materialType.name}</td>
                <td className="tabular px-3 py-2">{formatKg(Number(a.job.weightInKg))}</td>
                <td className="tabular px-3 py-2">{formatKg(Number(a.job.weightOutKg ?? 0))}</td>
                <td className="tabular px-3 py-2">{(Number(a.share) * 100).toFixed(0)}%</td>
                <td className="px-3 py-2"><Badge tone={statusTone(a.job.status)}>{a.job.status}</Badge></td>
              </tr>
            ))}
          </Table>
        </>
      )}

      {/* Wages */}
      {staff.payrollItems.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 font-medium">Wage history</h2>
          <Table headers={["Week", "Earned", "Advance deducted", "Net paid", "Status"]}>
            {staff.payrollItems.map((i) => (
              <tr key={i.id}>
                <td className="px-3 py-2">
                  {i.run.weekStart.toLocaleDateString("en-NG")} – {i.run.weekEnd.toLocaleDateString("en-NG")}
                </td>
                <td className="tabular px-3 py-2">{formatNaira(Number(i.earnedAmount))}</td>
                <td className="tabular px-3 py-2 text-warning">
                  {Number(i.advanceDeduction) > 0 ? `−${formatNaira(Number(i.advanceDeduction))}` : "—"}
                </td>
                <td className="tabular px-3 py-2 font-medium">{formatNaira(Number(i.netAmount))}</td>
                <td className="px-3 py-2">
                  <Badge tone={i.paidAt ? "success" : "warning"}>{i.paidAt ? "Paid" : "Unpaid"}</Badge>
                </td>
              </tr>
            ))}
          </Table>
        </>
      )}

      {/* Advances */}
      <h2 className="mb-2 mt-6 font-medium">Salary advances</h2>
      {isFinance && <Card className="mb-3"><AdvanceForm staffId={staff.id} /></Card>}
      {staff.advances.length === 0 ? (
        <Card><p className="py-3 text-center text-sm text-muted">No advances.</p></Card>
      ) : (
        <Table headers={["Date", "Amount", "Repaid", "Outstanding", "Note"]}>
          {staff.advances.map((a) => (
            <tr key={a.id}>
              <td className="px-3 py-2">{a.createdAt.toLocaleDateString("en-NG")}</td>
              <td className="tabular px-3 py-2">{formatNaira(Number(a.amount))}</td>
              <td className="tabular px-3 py-2">{formatNaira(Number(a.repaidAmount))}</td>
              <td className="tabular px-3 py-2 font-medium">
                {formatNaira(Number(a.amount) - Number(a.repaidAmount))}
              </td>
              <td className="px-3 py-2 text-muted">{a.note ?? "—"}</td>
            </tr>
          ))}
        </Table>
      )}

      {/* PPE issuances */}
      <h2 className="mb-2 mt-6 font-medium">PPE & equipment issued</h2>
      {isHr && <Card className="mb-3"><IssuanceForm staffId={staff.id} /></Card>}
      {staff.issuances.length === 0 ? (
        <Card><p className="py-3 text-center text-sm text-muted">Nothing issued yet.</p></Card>
      ) : (
        <Table headers={["Date", "Item", "Qty", "Condition"]}>
          {staff.issuances.map((i) => (
            <tr key={i.id}>
              <td className="px-3 py-2">{i.issuedAt.toLocaleDateString("en-NG")}</td>
              <td className="px-3 py-2">{i.item}</td>
              <td className="tabular px-3 py-2">{i.quantity}</td>
              <td className="px-3 py-2">{i.condition ?? "—"}</td>
            </tr>
          ))}
        </Table>
      )}

      {/* Medical / rewards / disciplinary */}
      <h2 className="mb-2 mt-6 font-medium">Medical, rewards & disciplinary log</h2>
      {isHr && <Card className="mb-3"><StaffLogForm staffId={staff.id} /></Card>}
      {staff.staffLogs.length === 0 ? (
        <Card><p className="py-3 text-center text-sm text-muted">No entries.</p></Card>
      ) : (
        <Table headers={["Date", "Type", "Description", "Cost"]}>
          {staff.staffLogs.map((l) => (
            <tr key={l.id}>
              <td className="px-3 py-2">{l.createdAt.toLocaleDateString("en-NG")}</td>
              <td className="px-3 py-2"><Badge tone={LOG_TONE[l.kind]}>{l.kind}</Badge></td>
              <td className="px-3 py-2">{l.description}</td>
              <td className="tabular px-3 py-2">{l.cost ? formatNaira(Number(l.cost)) : "—"}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
