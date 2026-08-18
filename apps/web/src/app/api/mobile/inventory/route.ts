import { NextResponse, type NextRequest } from "next/server";
import { mobileSession, mobileHasRole } from "@/lib/mobile-auth";
import { accessibleSiteIds } from "@/lib/auth";
import { inventoryBuckets } from "@/lib/inventory";

/** Live inventory buckets (raw / waiting / in-stage / finished) for the factory. */
export async function GET(request: NextRequest) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mobileHasRole(session, ["FACTORY_SUPERVISOR", "OPERATIONS_MANAGER"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const b = await inventoryBuckets(accessibleSiteIds(session));
  const sum = (rows: { kg: number }[]) => rows.reduce((t, r) => t + r.kg, 0);
  const activeKg = b.active.reduce((t, s) => t + sum(s.materials), 0);

  return NextResponse.json({
    totals: {
      raw: sum(b.raw),
      waiting: sum(b.waiting),
      active: activeKg,
      finished: sum(b.finished),
    },
    raw: b.raw,
    waiting: b.waiting,
    active: b.active,
    finished: b.finished,
  });
}
