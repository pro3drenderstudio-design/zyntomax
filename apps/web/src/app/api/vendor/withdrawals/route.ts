import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { vendorFromRequest } from "@/lib/vendor-auth";
import { vendorBalance } from "@/lib/vendor-wallet";
import { getSetting } from "@/lib/settings";
import { sendSms } from "@/lib/sms";

export async function GET(request: NextRequest) {
  const vendorId = await vendorFromRequest(request);
  if (!vendorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await prisma.withdrawal.findMany({ where: { vendorId }, orderBy: { requestedAt: "desc" }, take: 50 });
  return NextResponse.json({
    withdrawals: rows.map((w) => ({
      id: w.id, amount: Number(w.amount), status: w.status, requestedAt: w.requestedAt,
      processedAt: w.processedAt, bankName: w.bankName, last4: w.accountLast4, failureReason: w.failureReason,
    })),
  });
}

/** Request a withdrawal to the vendor's verified bank account. */
export async function POST(request: NextRequest) {
  const vendorId = await vendorFromRequest(request);
  if (!vendorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { amount } = (await request.json()) as { amount?: number };
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!vendor.bankVerified || !vendor.paystackRecipient) {
    return NextResponse.json({ error: "Add and verify your bank account before withdrawing." }, { status: 422 });
  }
  const min = await getSetting<number>("wallet.min_withdrawal", 1000, vendor.siteId);
  if (!amount || amount < min) {
    return NextResponse.json({ error: `Minimum withdrawal is ₦${min.toLocaleString("en-NG")}.` }, { status: 422 });
  }

  // No overlapping pending request
  const openReq = await prisma.withdrawal.findFirst({ where: { vendorId, status: { in: ["PENDING", "APPROVED"] } } });
  if (openReq) {
    return NextResponse.json({ error: "You already have a withdrawal being processed." }, { status: 409 });
  }

  const balance = await vendorBalance(vendorId);
  if (amount > balance.available + 0.001) {
    return NextResponse.json({ error: `You can withdraw up to ₦${balance.available.toLocaleString("en-NG")}.` }, { status: 422 });
  }

  const w = await prisma.withdrawal.create({
    data: {
      vendorId,
      amount,
      status: "PENDING",
      bankName: vendor.bankName,
      accountLast4: vendor.bankAccountNo ? vendor.bankAccountNo.slice(-4) : null,
      idempotencyKey: `wd_${vendorId}_${Date.now()}`,
    },
  });
  await sendSms({
    to: vendor.phone,
    vendorId,
    body: `Zyntomax: your withdrawal of ₦${amount.toLocaleString("en-NG")} is being processed. We'll notify you when it's paid.`,
  });

  return NextResponse.json({ id: w.id, status: w.status });
}
