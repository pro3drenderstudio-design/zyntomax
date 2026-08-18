import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { mobileSession, mobileHasRole } from "@/lib/mobile-auth";
import { audit } from "@/lib/audit";

const ALLOWED = ["ACTIVE", "SUSPENDED", "EXITED"] as const;

/** Suspend / reactivate / exit a staff member from mobile. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mobileHasRole(session, ["HR_ADMIN", "OPERATIONS_MANAGER"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const body = (await request.json()) as { status?: string };
  const status = body.status as (typeof ALLOWED)[number];
  if (!ALLOWED.includes(status)) return NextResponse.json({ error: "Invalid status" }, { status: 422 });

  const staff = await prisma.staffProfile.findUnique({ where: { id } });
  if (!staff) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.user.update({ where: { id: staff.userId }, data: { status } });
  await audit({ actorId: session.userId, action: "staff.status", entity: "StaffProfile", entityId: id, after: { status } });
  return NextResponse.json({ ok: true, status });
}
