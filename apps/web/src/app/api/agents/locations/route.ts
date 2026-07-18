import { NextResponse } from "next/server";
import { prisma, Prisma } from "@zyntomax/db";
import { getSession } from "@/lib/session";
import { hasRole } from "@/lib/auth";

/** Latest location per agent in the last 30 minutes (admin live tracking). */
export async function GET() {
  const session = await getSession();
  if (!session || !hasRole(session, ["OPERATIONS_MANAGER", "TEAM_LEAD"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const since = new Date(Date.now() - 30 * 60 * 1000);
  const rows = await prisma.$queryRaw<
    { userId: string; name: string; lat: number; lng: number; recordedAt: Date; tripId: string | null }[]
  >(Prisma.sql`
    SELECT DISTINCT ON (al."userId")
      al."userId", u.name, al.lat, al.lng, al."recordedAt", al."tripId"
    FROM "AgentLocation" al
    JOIN "User" u ON u.id = al."userId"
    WHERE al."recordedAt" >= ${since}
    ORDER BY al."userId", al."recordedAt" DESC
  `);

  return NextResponse.json({
    agents: rows.map((r) => ({
      userId: r.userId,
      name: r.name,
      lat: r.lat,
      lng: r.lng,
      recordedAt: r.recordedAt,
      tripId: r.tripId,
      minutesAgo: Math.round((Date.now() - new Date(r.recordedAt).getTime()) / 60000),
    })),
  });
}
