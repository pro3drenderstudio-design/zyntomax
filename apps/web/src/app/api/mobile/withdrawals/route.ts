import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { mobileSession, mobileHasRole } from "@/lib/mobile-auth";
import { companyFloat } from "@/lib/withdrawals";

/** Vendor withdrawal review queue for finance staff on mobile. */
export async function GET(request: NextRequest) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mobileHasRole(session, ["FINANCE_ADMIN"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [rows, float] = await Promise.all([
    prisma.withdrawal.findMany({ include: { vendor: true }, orderBy: { requestedAt: "desc" }, take: 100 }),
    companyFloat(),
  ]);

  const pending = rows.filter((w) => w.status === "PENDING" || w.status === "APPROVED");
  const pendingTotal = pending.reduce((s, w) => s + Number(w.amount), 0);
  const paidTotal = rows.filter((w) => w.status === "PAID").reduce((s, w) => s + Number(w.amount), 0);

  return NextResponse.json({
    float,
    pendingCount: pending.length,
    pendingTotal,
    paidTotal,
    withdrawals: rows.map((w) => ({
      id: w.id,
      vendor: w.vendor.name,
      phone: w.vendor.phone,
      amount: Number(w.amount),
      status: w.status,
      bankName: w.bankName,
      accountLast4: w.accountLast4,
      failureReason: w.failureReason,
      requestedAt: w.requestedAt,
    })),
  });
}
