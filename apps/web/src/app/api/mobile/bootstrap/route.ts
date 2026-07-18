import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { mobileSession } from "@/lib/mobile-auth";
import { NIGERIAN_BANKS } from "@/lib/paystack";

/** Master data the field app caches for offline use. */
export async function GET(request: NextRequest) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [sites, localities, materials, vendors] = await Promise.all([
    prisma.site.findMany({ where: { active: true }, select: { id: true, name: true } }),
    prisma.locality.findMany({ select: { id: true, name: true, siteId: true } }),
    prisma.materialType.findMany({
      where: { active: true },
      select: { id: true, name: true },
    }),
    prisma.vendor.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, phone: true, localityId: true, siteId: true, lat: true, lng: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({ sites, localities, materials, vendors, banks: NIGERIAN_BANKS });
}
