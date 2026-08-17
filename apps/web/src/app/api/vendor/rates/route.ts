import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { vendorFromRequest } from "@/lib/vendor-auth";

/** Current price (₦/kg) vendors are paid per material — latest effective rate. */
export async function GET(request: NextRequest) {
  const vendorId = await vendorFromRequest(request);
  if (!vendorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rates = await prisma.vendorRate.findMany({
    where: { effectiveFrom: { lte: new Date() } },
    include: { materialType: true },
    orderBy: { effectiveFrom: "desc" },
  });
  // Latest rate per material
  const latest = new Map<string, { material: string; color: string | null; pricePerKg: number }>();
  for (const r of rates) {
    if (!latest.has(r.materialTypeId) && r.materialType.active) {
      latest.set(r.materialTypeId, { material: r.materialType.name, color: r.materialType.color, pricePerKg: Number(r.pricePerKg) });
    }
  }
  return NextResponse.json({ rates: [...latest.values()].sort((a, b) => b.pricePerKg - a.pricePerKg) });
}
