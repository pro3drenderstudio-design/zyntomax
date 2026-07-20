import { prisma } from "@zyntomax/db";
import { requireSession, hasRole } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { CreateMaterialForm, CreateStageForm } from "./create-forms";
import { RecipeManager } from "./recipe-manager";
import { MaterialList } from "./material-list";

export default async function MaterialsPage() {
  const session = await requireSession();
  const canEdit = hasRole(session, ["OPERATIONS_MANAGER"]);

  const [materials, stages, recipes] = await Promise.all([
    prisma.materialType.findMany({ where: { active: true }, orderBy: [{ kind: "asc" }, { name: "asc" }] }),
    prisma.processStage.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.stageOutput.findMany({ where: { active: true } }),
  ]);

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

      <div className="mb-4">
        <MaterialList
          canEdit={canEdit}
          materials={materials.map((m) => ({ id: m.id, name: m.name, kind: m.kind, color: m.color, sellable: m.sellable }))}
        />
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
