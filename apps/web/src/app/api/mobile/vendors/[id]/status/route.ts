import { NextResponse, type NextRequest } from "next/server";
import { mobileSession, mobileHasRole } from "@/lib/mobile-auth";
import { setVendorStatusById } from "@/lib/vendors";

const ALLOWED = ["ACTIVE", "INACTIVE", "BLACKLISTED"] as const;

/** Activate / deactivate / blacklist a vendor. */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mobileHasRole(session, ["OPERATIONS_MANAGER"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const body = (await request.json()) as { status?: string };
  const status = body.status as (typeof ALLOWED)[number];
  if (!ALLOWED.includes(status)) return NextResponse.json({ error: "Invalid status" }, { status: 422 });
  await setVendorStatusById(id, status, session.userId);
  return NextResponse.json({ ok: true, status });
}
