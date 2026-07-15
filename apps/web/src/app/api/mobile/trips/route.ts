import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { mobileSession } from "@/lib/mobile-auth";

/** Trips the signed-in staff member is on (as lead or member), most recent first. */
export async function GET(request: NextRequest) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const staff = await prisma.staffProfile.findUnique({
    where: { userId: session.userId },
  });
  if (!staff) return NextResponse.json({ trips: [] });

  const trips = await prisma.trip.findMany({
    where: {
      OR: [{ leadId: staff.id }, { members: { some: { staffId: staff.id } } }],
      status: { in: ["PLANNED", "IN_PROGRESS", "RETURNED"] },
    },
    include: {
      locality: { select: { name: true } },
      weighIns: { select: { id: true, vendorId: true, weightKg: true, amount: true } },
    },
    orderBy: { date: "desc" },
    take: 20,
  });

  return NextResponse.json({
    trips: trips.map((t) => ({
      id: t.id,
      date: t.date,
      status: t.status,
      locality: t.locality?.name ?? null,
      vehicle: t.vehicle,
      weighInCount: t.weighIns.length,
      totalKg: t.weighIns.reduce((s, w) => s + Number(w.weightKg), 0),
      totalAmount: t.weighIns.reduce((s, w) => s + Number(w.amount), 0),
    })),
  });
}
