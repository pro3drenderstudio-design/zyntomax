import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { mobileSession } from "@/lib/mobile-auth";

/** Job detail + the recipe outputs to weigh at scale-out. */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const job = await prisma.job.findUnique({
    where: { id },
    include: { stage: true, materialType: true, assignments: { include: { staff: { include: { user: true } } } }, outputs: { include: { outputMaterial: true } } },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const recipes = await prisma.stageOutput.findMany({
    where: { stageId: job.stageId, inputMaterialTypeId: job.materialTypeId, active: true },
    include: { outputMaterial: true },
  });

  return NextResponse.json({
    id: job.id,
    stage: job.stage.name,
    inputMaterial: job.materialType.name,
    weightInKg: Number(job.weightInKg),
    weightOutKg: job.weightOutKg === null ? null : Number(job.weightOutKg),
    wasteKg: job.wasteKg === null ? null : Number(job.wasteKg),
    status: job.status,
    flagReason: job.flagReason,
    tolerancePct: Number(job.toleranceSnapshot),
    scaleInPhotoUrl: job.scaleInPhotoUrl,
    scaleOutPhotoUrl: job.scaleOutPhotoUrl,
    startedAt: job.startedAt,
    assignees: job.assignments.map((a) => a.staff.user.name),
    outputs: recipes.map((r) => ({ materialId: r.outputMaterialTypeId, name: r.outputMaterial.name, kind: r.outputMaterial.kind })),
    recorded: job.outputs.map((o) => ({ materialId: o.outputMaterialTypeId, name: o.outputMaterial.name, weightKg: Number(o.weightKg) })),
  });
}
