import Link from "next/link";
import { prisma } from "@zyntomax/db";
import { requireSession, accessibleSiteIds, hasRole } from "@/lib/auth";
import {
  PageHeader, Card, Badge, statusTone, Table, formatKg,
} from "@/components/ui";
import { CreateJobForm, CompleteJobForm, ResolveJobForm } from "./job-forms";

export default async function ProductionPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireSession();
  const siteIds = accessibleSiteIds(session);
  const { status } = await searchParams;
  const canSupervise = hasRole(session, ["FACTORY_SUPERVISOR", "OPERATIONS_MANAGER"]);

  const [jobs, sites, stages, materials, staff, routes, stageOutputs] = await Promise.all([
    prisma.job.findMany({
      where: {
        ...(siteIds ? { siteId: { in: siteIds } } : {}),
        ...(status ? { status: status as never } : {}),
      },
      include: {
        stage: true,
        materialType: true,
        assignments: { include: { staff: { include: { user: true } } } },
        outputs: { include: { stageOutput: true } },
      },
      orderBy: [{ status: "asc" }, { startedAt: "desc" }],
      take: 100,
    }),
    prisma.site.findMany({ where: { active: true, ...(siteIds ? { id: { in: siteIds } } : {}) } }),
    prisma.processStage.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.materialType.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.staffProfile.findMany({
      where: { user: { status: "ACTIVE" } },
      include: { user: true },
      orderBy: { staffNo: "asc" },
    }),
    prisma.materialRoute.findMany({ select: { materialTypeId: true, stageId: true } }),
    prisma.stageOutput.findMany({ where: { active: true } }),
  ]);

  // outputs available for a given (stage, material)
  const outputsFor = (stageId: string, materialTypeId: string) =>
    stageOutputs
      .filter((o) => o.stageId === stageId && o.materialTypeId === materialTypeId)
      .map((o) => ({ id: o.id, name: o.name, color: o.color }));

  const open = jobs.filter((j) => ["ASSIGNED", "IN_PROGRESS"].includes(j.status));
  const flagged = jobs.filter((j) => j.status === "FLAGGED");
  const done = jobs.filter((j) => ["COMPLETED", "RESOLVED"].includes(j.status));

  return (
    <div>
      <PageHeader
        title="Production jobs"
        subtitle="Scale in → work → scale out (output + waste). Discrepancies beyond tolerance are flagged."
      />

      {canSupervise && (
        <Card className="mb-4">
          <h2 className="mb-3 font-medium">New job assignment</h2>
          <CreateJobForm
            sites={sites.map((s) => ({ id: s.id, name: s.name }))}
            stages={stages.map((s) => ({ id: s.id, name: s.name }))}
            materials={materials.map((m) => ({ id: m.id, name: m.name }))}
            staff={staff.map((s) => ({ id: s.id, name: `${s.user.name} (${s.staffNo})` }))}
            routes={routes}
          />
        </Card>
      )}

      {flagged.length > 0 && (
        <>
          <h2 className="mb-2 font-medium text-destructive">
            Flagged — needs supervisor resolution ({flagged.length})
          </h2>
          <div className="mb-5 flex flex-col gap-3">
            {flagged.map((j) => (
              <Card key={j.id} className="border-destructive">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <Link href={`/production/${j.id}`} className="font-medium hover:underline">
                    {j.stage.name} — {j.materialType.name}
                  </Link>
                  <Badge tone="destructive">FLAGGED</Badge>
                </div>
                <p className="tabular mb-1 text-sm">
                  In {formatKg(Number(j.weightInKg))} → out {formatKg(Number(j.weightOutKg ?? 0))} + waste {formatKg(Number(j.wasteKg ?? 0))}
                </p>
                {j.outputs.length > 0 && (
                  <div className="mb-1 flex flex-wrap gap-1.5">
                    {j.outputs.map((o) => (
                      <span key={o.id} className="inline-flex items-center gap-1 rounded-full bg-muted-bg px-2 py-0.5 text-xs">
                        <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: o.stageOutput.color ?? "#cbd5e1" }} aria-hidden />
                        {o.stageOutput.name}: {formatKg(Number(o.weightKg))}
                      </span>
                    ))}
                  </div>
                )}
                <p className="mb-3 text-sm text-destructive">{j.flagReason}</p>
                <p className="mb-3 text-xs text-muted">
                  {j.assignments.map((a) => a.staff.user.name).join(", ")}
                </p>
                {canSupervise && <ResolveJobForm jobId={j.id} />}
              </Card>
            ))}
          </div>
        </>
      )}

      <h2 className="mb-2 font-medium">Open jobs ({open.length})</h2>
      {open.length === 0 ? (
        <Card className="mb-5">
          <p className="py-4 text-center text-sm text-muted">No open jobs.</p>
        </Card>
      ) : (
        <div className="mb-5 flex flex-col gap-3">
          {open.map((j) => (
            <Card key={j.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Link href={`/production/${j.id}`} className="font-medium hover:underline">
                    {j.stage.name} — {j.materialType.name}
                  </Link>
                  <p className="tabular text-sm text-muted">
                    {formatKg(Number(j.weightInKg))} in ·{" "}
                    {j.assignments.map((a) => a.staff.user.name).join(", ")} · started{" "}
                    {j.startedAt.toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {canSupervise && (
                  <CompleteJobForm jobId={j.id} outputs={outputsFor(j.stageId, j.materialTypeId)} />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <h2 className="mb-2 font-medium">Recently completed</h2>
      <Table headers={["Stage", "Material", "In", "Out", "Waste", "Discrepancy", "Staff", "Status"]}>
        {done.slice(0, 30).map((j) => {
          const disc = Number(j.weightInKg) - Number(j.weightOutKg ?? 0) - Number(j.wasteKg ?? 0);
          const pct = Number(j.weightInKg) > 0 ? (disc / Number(j.weightInKg)) * 100 : 0;
          return (
            <tr key={j.id} className="hover:bg-muted-bg">
              <td className="px-3 py-2">
                <Link href={`/production/${j.id}`} className="font-medium hover:underline">{j.stage.name}</Link>
              </td>
              <td className="px-3 py-2">{j.materialType.name}</td>
              <td className="tabular px-3 py-2">{formatKg(Number(j.weightInKg))}</td>
              <td className="tabular px-3 py-2">{formatKg(Number(j.weightOutKg ?? 0))}</td>
              <td className="tabular px-3 py-2">{formatKg(Number(j.wasteKg ?? 0))}</td>
              <td className={`tabular px-3 py-2 ${Math.abs(pct) > Number(j.toleranceSnapshot) ? "text-destructive" : "text-muted"}`}>
                {pct.toFixed(1)}%
              </td>
              <td className="px-3 py-2 text-xs">{j.assignments.map((a) => a.staff.user.name).join(", ")}</td>
              <td className="px-3 py-2"><Badge tone={statusTone(j.status)}>{j.status}</Badge></td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}
