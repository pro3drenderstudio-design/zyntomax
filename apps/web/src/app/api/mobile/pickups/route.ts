import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { mobileSession } from "@/lib/mobile-auth";

/** Pending pickup requests with vendor + location, for the field app. */
export async function GET(request: NextRequest) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const requests = await prisma.pickupRequest.findMany({
    where: { status: { in: ["PENDING", "SCHEDULED"] } },
    include: { vendor: { include: { locality: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json({
    pickups: requests.map((r) => ({
      id: r.id,
      estWeightKg: Number(r.estWeightKg),
      status: r.status,
      createdAt: r.createdAt,
      vendor: {
        id: r.vendor.id,
        name: r.vendor.name,
        phone: r.vendor.phone,
        lat: r.vendor.lat,
        lng: r.vendor.lng,
        address: r.vendor.address,
        locality: r.vendor.locality?.name ?? null,
      },
    })),
  });
}
