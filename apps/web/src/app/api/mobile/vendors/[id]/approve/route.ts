import { NextResponse, type NextRequest } from "next/server";
import { mobileSession, mobileHasRole } from "@/lib/mobile-auth";
import { approveVendorById } from "@/lib/vendors";

/** Approve a PENDING self-registered vendor. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mobileHasRole(session, ["OPERATIONS_MANAGER", "HR_ADMIN"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const res = await approveVendorById(id, session.userId);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 422 });
  return NextResponse.json({ ok: true });
}
