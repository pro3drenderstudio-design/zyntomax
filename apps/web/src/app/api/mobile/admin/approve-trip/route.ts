import { NextResponse, type NextRequest } from "next/server";
import { mobileSession, mobileHasRole } from "@/lib/mobile-auth";
import { approveTripById } from "@/lib/trips";

/** Approve a reconciled trip from the admin mobile app (creates payout batch). */
export async function POST(request: NextRequest) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mobileHasRole(session, ["OPERATIONS_MANAGER", "FACTORY_SUPERVISOR"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { tripId } = (await request.json()) as { tripId?: string };
  if (!tripId) return NextResponse.json({ error: "tripId required" }, { status: 400 });

  const result = await approveTripById(tripId, session.userId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 });
  return NextResponse.json({ ok: true, total: result.total });
}
