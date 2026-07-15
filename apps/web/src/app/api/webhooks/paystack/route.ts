import { NextResponse, type NextRequest } from "next/server";
import { createHmac } from "crypto";
import { prisma } from "@zyntomax/db";

/**
 * Paystack webhook — transfer.success / transfer.failed / transfer.reversed.
 * Signature is verified with the secret key before anything is trusted.
 */
export async function POST(request: NextRequest) {
  const raw = await request.text();
  const signature = request.headers.get("x-paystack-signature");
  const secretKey = process.env.PAYSTACK_SECRET_KEY ?? "";

  const expected = createHmac("sha512", secretKey).update(raw).digest("hex");
  if (!signature || signature !== expected) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(raw) as {
    event: string;
    data: { reference?: string; transfer_code?: string; reason?: string };
  };

  const ref = event.data.reference;
  if (!ref) return NextResponse.json({ ok: true });

  const payout = await prisma.payout.findUnique({ where: { idempotencyKey: ref } });
  if (!payout) return NextResponse.json({ ok: true });

  if (event.event === "transfer.success") {
    await prisma.payout.update({
      where: { id: payout.id },
      data: { status: "SUCCESS", failureReason: null },
    });
  } else if (event.event === "transfer.failed") {
    await prisma.payout.update({
      where: { id: payout.id },
      data: { status: "FAILED", failureReason: "Transfer failed at bank" },
    });
  } else if (event.event === "transfer.reversed") {
    await prisma.$transaction([
      prisma.payout.update({
        where: { id: payout.id },
        data: { status: "REVERSED" },
      }),
      // Money came back — reverse the wallet ledger entry
      prisma.walletTransaction.create({
        data: {
          kind: "REFUND",
          amount: Number(payout.amount),
          paystackRef: event.data.transfer_code,
          note: "Transfer reversed",
        },
      }),
    ]);
  }

  // Batch rollup
  const remaining = await prisma.payout.count({
    where: {
      batchId: payout.batchId,
      status: { in: ["PENDING", "PROCESSING", "FAILED"] },
    },
  });
  if (remaining === 0) {
    await prisma.payoutBatch.update({
      where: { id: payout.batchId },
      data: { status: "COMPLETED" },
    });
  }

  return NextResponse.json({ ok: true });
}
