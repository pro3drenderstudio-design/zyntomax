import { prisma } from "@zyntomax/db";
import { requireSession } from "@/lib/auth";
import { PageHeader, Card, Badge } from "@/components/ui";
import { CreateMaterialForm, CreateStageForm } from "./create-forms";
import { RecipeManager } from "./recipe-manager";

const KIND_LABEL: Record<string, string> = {
  RAW: "Raw materials (purchased)",
  INTERMEDIATE: "Intermediate materials (in processing)",
  FINISHED: "Finished goods (sellable)",
};
const KIND_TONE = { RAW: "neutral", INTERMEDIATE: "info", FINISHED: "success" } as const;

export default async function MaterialsPage() {
  await requireSession();

  const [materials, stages, recipes] = await Promise.all([
    prisma.materialType.findMany({ where: { active: true }, orderBy: [{ kind: "asc" }, { name: "asc" }] }),
    prisma.processStage.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.stageOutput.findMany({ where: { active: true } }),
  ]);

  const byKind = (k: string) => materials.filter((m) => m.kind === k);

  return (
    <div>
      <PageHeader
        title="Materials & recipes"
        subtitle="Every material — raw, intermediate, finished — and how each stage transforms one into another"
      />

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <Card><h2 className="mb-3 font-medium">Add material</h2><CreateMaterialForm /></Card>
        <Card><h2 className="mb-3 font-medium">Add process stage</h2><CreateStageForm /></Card>
      </div>

      <div className="mb-4 grid gap-3 lg:grid-cols-3">
        {(["RAW", "INTERMEDIATE", "FINISHED"] as const).map((kind) => (
          <Card key={kind}>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-sm font-medium">{KIND_LABEL[kind]}</h2>
              <Badge tone={KIND_TONE[kind]}>{byKind(kind).length}</Badge>
            </div>
            <ul className="flex flex-wrap gap-1.5">
              {byKind(kind).map((m) => (
                <li key={m.id} className="inline-flex items-center gap-1.5 rounded-full bg-muted-bg px-2.5 py-1 text-sm">
                  <span className="inline-block h-2.5 w-2.5 rounded-full border border-border" style={{ backgroundColor: m.color ?? "#cbd5e1" }} aria-hidden />
                  {m.name}
                </li>
              ))}
              {byKind(kind).length === 0 && <li className="text-sm text-muted">None yet.</li>}
            </ul>
          </Card>
        ))}
      </div>

      <h2 className="mb-2 mt-6 font-medium">Recipes & pay basis</h2>
      <Card>
        <RecipeManager
          stages={stages.map((s) => ({ id: s.id, name: s.name, payBasis: s.payBasis }))}
          materials={materials.map((m) => ({ id: m.id, name: m.name, kind: m.kind, color: m.color }))}
          recipes={recipes.map((r) => ({ id: r.id, stageId: r.stageId, inputId: r.inputMaterialTypeId, outputId: r.outputMaterialTypeId }))}
        />
      </Card>
    </div>
  );
}
