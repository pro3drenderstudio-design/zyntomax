import { prisma } from "@zyntomax/db";
import { requireSession } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { RouteEditor } from "./route-editor";
import { CreateMaterialForm, CreateStageForm } from "./create-forms";
import { StageManager } from "./stage-manager";

export default async function MaterialsPage() {
  await requireSession();

  const [materials, stages, stageOutputs] = await Promise.all([
    prisma.materialType.findMany({
      where: { active: true },
      include: { routes: { orderBy: { sequence: "asc" } } },
      orderBy: { name: "asc" },
    }),
    prisma.processStage.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.stageOutput.findMany({ where: { active: true } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Materials & process stages"
        subtitle="Each material follows its own ordered route through the factory"
      />

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <Card><CreateMaterialForm /></Card>
        <Card><CreateStageForm /></Card>
      </div>

      <div className="flex flex-col gap-3">
        {materials.map((m) => (
          <Card key={m.id}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="font-medium">{m.name}</p>
              <RouteEditor
                materialTypeId={m.id}
                materialName={m.name}
                allStages={stages.map((s) => ({ id: s.id, name: s.name }))}
                currentStageIds={m.routes.map((r) => r.stageId)}
              />
            </div>
          </Card>
        ))}
      </div>

      <h2 className="mb-2 mt-6 font-medium">Stage outputs & pay basis</h2>
      <Card>
        <StageManager
          stages={stages.map((s) => ({ id: s.id, name: s.name, payBasis: s.payBasis }))}
          materials={materials.map((m) => ({ id: m.id, name: m.name }))}
          outputs={stageOutputs.map((o) => ({
            id: o.id,
            stageId: o.stageId,
            materialTypeId: o.materialTypeId,
            name: o.name,
            color: o.color,
          }))}
        />
      </Card>
    </div>
  );
}
