import { NextResponse, type NextRequest } from "next/server";
import { mobileSession, mobileHasRole } from "@/lib/mobile-auth";
import { payPayrollItem } from "@/lib/payroll";

/** Mark a payroll line paid (finance only). */
export async function POST(request: NextRequest, ctx: { params: Promise<{ itemId: string }> }) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mobileHasRole(session, ["FINANCE_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { itemId } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { paymentRef?: string };

  await payPayrollItem(itemId, session.userId, body.paymentRef);
  return NextResponse.json({ ok: true });
}
