import { NextResponse, type NextRequest } from "next/server";
import { mobileSession, mobileHasRole } from "@/lib/mobile-auth";
import { approveWithdrawalById } from "@/lib/withdrawals";

/** Approve + pay a vendor withdrawal (float-guarded, shared with the web action). */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mobileHasRole(session, ["FINANCE_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;
  const res = await approveWithdrawalById(id, session.userId);
  if (!res.ok) return NextResponse.json({ error: res.error, status: res.status }, { status: 422 });
  return NextResponse.json({ ok: true, status: res.status });
}
