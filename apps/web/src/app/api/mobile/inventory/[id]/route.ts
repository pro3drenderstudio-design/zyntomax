import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { mobileSession, mobileHasRole } from "@/lib/mobile-auth";
import { accessibleSiteIds } from "@/lib/auth";
import { materialHistory, materialAvailable } from "@/lib/inventory";

/** One material's stock + recent movement history. */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mobileHasRole(session, ["FACTORY_SUPERVISOR", "OPERATIONS_MANAGER"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;

  const material = await prisma.materialType.findUnique({ where: { id } });
  if (!material) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const siteIds = accessibleSiteIds(session);
  const [movements, primarySite] = await Promise.all([
    materialHistory(id, siteIds),
    prisma.site.findFirst({ where: siteIds ? { id: { in: siteIds } } : { active: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const availableKg = primarySite ? await materialAvailable(primarySite.id, id) : 0;

  return NextResponse.json({
    material: { id: material.id, name: material.name, kind: material.kind, color: material.color },
    availableKg,
    movements: movements.map((m) => ({
      createdAt: m.createdAt,
      weightKg: m.weightKg,
      from: m.from,
      to: m.to,
      by: m.by,
      note: m.note,
      refType: m.refType,
    })),
  });
}
