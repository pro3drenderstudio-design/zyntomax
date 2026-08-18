import { NextResponse, type NextRequest } from "next/server";
import { mobileSession, mobileHasRole } from "@/lib/mobile-auth";
import { pnlReport, reportPeriod } from "@/lib/reports";

/** Monthly P&L snapshot for finance/ops on mobile. Optional ?month=YYYY-MM. */
export async function GET(request: NextRequest) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mobileHasRole(session, ["FINANCE_ADMIN", "OPERATIONS_MANAGER"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { period, from, to } = reportPeriod(request.nextUrl.searchParams.get("month") ?? undefined);
  const pnl = await pnlReport(from, to);
  return NextResponse.json({ period, ...pnl });
}
