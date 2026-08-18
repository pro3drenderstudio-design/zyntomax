import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { mobileSession, mobileHasRole } from "@/lib/mobile-auth";
import { inventoryBuckets } from "@/lib/inventory";

/** Scale-in setup: stages, available input materials, and each stage/input's recipe outputs. */
export async function GET(request: NextRequest) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mobileHasRole(session, ["FACTORY_SUPERVISOR", "OPERATIONS_MANAGER", "PRODUCTION_STAFF"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const siteId = request.nextUrl.searchParams.get("siteId")
    || (await prisma.site.findFirst({ where: { active: true }, orderBy: { createdAt: "asc" } }))?.id;
  if (!siteId) return NextResponse.json({ error: "No site" }, { status: 404 });

  const [stages, recipes, buckets] = await Promise.all([
    prisma.processStage.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.stageOutput.findMany({ where: { active: true }, include: { outputMaterial: true } }),
    inventoryBuckets([siteId]),
  ]);

  // Available input stock = raw (intake) + intermediates (in-processing pool)
  const stock = [...buckets.raw, ...buckets.waiting];
  const stagesForInput = new Map<string, Set<string>>();
  const outputsByKey: Record<string, { materialId: string; name: string; kind: string }[]> = {};
  for (const r of recipes) {
    if (!stagesForInput.has(r.inputMaterialTypeId)) stagesForInput.set(r.inputMaterialTypeId, new Set());
    stagesForInput.get(r.inputMaterialTypeId)!.add(r.stageId);
    const key = `${r.stageId}:${r.inputMaterialTypeId}`;
    (outputsByKey[key] ??= []).push({ materialId: r.outputMaterialTypeId, name: r.outputMaterial.name, kind: r.outputMaterial.kind });
  }

  const inputs = stock
    .filter((m) => stagesForInput.has(m.materialId))
    .map((m) => ({ materialId: m.materialId, name: m.name, kind: m.kind, availableKg: m.kg, stageIds: [...stagesForInput.get(m.materialId)!] }));

  return NextResponse.json({
    siteId,
    stages: stages.map((s) => ({ id: s.id, name: s.name })),
    inputs,
    outputsByKey,
  });
}
