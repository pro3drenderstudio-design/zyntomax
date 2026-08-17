import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { vendorFromRequest } from "@/lib/vendor-auth";

/** Live tracking for a scheduled pickup: the assigned collector's latest GPS + the vendor location. */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const vendorId = await vendorFromRequest(request);
  if (!vendorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const pickup = await prisma.pickupRequest.findFirst({
    where: { id, vendorId },
    include: { vendor: true, trip: { include: { lead: { include: { user: true } } } } },
  });
  if (!pickup) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let collector: { name: string; lat: number; lng: number; recordedAt: Date } | null = null;
  const leadUserId = pickup.trip?.lead?.userId;
  if (leadUserId) {
    const loc = await prisma.agentLocation.findFirst({
      where: { userId: leadUserId },
      orderBy: { recordedAt: "desc" },
    });
    if (loc) {
      collector = { name: pickup.trip!.lead!.user.name, lat: loc.lat, lng: loc.lng, recordedAt: loc.recordedAt };
    }
  }

  return NextResponse.json({
    status: pickup.status,
    vendor: pickup.lat != null && pickup.lng != null
      ? { lat: pickup.lat, lng: pickup.lng }
      : pickup.vendor.lat != null && pickup.vendor.lng != null
        ? { lat: pickup.vendor.lat, lng: pickup.vendor.lng }
        : null,
    collector,
  });
}
