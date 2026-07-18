import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { mobileSession } from "@/lib/mobile-auth";

/** Field app posts the agent's GPS periodically during a trip. */
export async function POST(request: NextRequest) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { lat, lng, tripId } = (await request.json()) as {
    lat?: number;
    lng?: number;
    tripId?: string;
  };
  if (typeof lat !== "number" || typeof lng !== "number") {
    return NextResponse.json({ error: "lat/lng required" }, { status: 400 });
  }

  await prisma.agentLocation.create({
    data: { userId: session.userId, lat, lng, tripId: tripId ?? null },
  });

  // Keep only the last ~50 breadcrumbs per agent
  const old = await prisma.agentLocation.findMany({
    where: { userId: session.userId },
    orderBy: { recordedAt: "desc" },
    skip: 50,
    select: { id: true },
  });
  if (old.length > 0) {
    await prisma.agentLocation.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  }

  return NextResponse.json({ ok: true });
}
