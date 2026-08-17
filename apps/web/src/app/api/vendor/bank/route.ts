import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { vendorFromRequest } from "@/lib/vendor-auth";
import { resolveAccount, createTransferRecipient, NIGERIAN_BANKS } from "@/lib/paystack";

/** List Nigerian banks for the account picker. */
export async function GET(request: NextRequest) {
  const vendorId = await vendorFromRequest(request);
  if (!vendorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ banks: NIGERIAN_BANKS });
}

/** Add & verify the vendor's bank account (resolve → create transfer recipient). */
export async function POST(request: NextRequest) {
  const vendorId = await vendorFromRequest(request);
  if (!vendorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { bankCode, bankName, accountNo } = (await request.json()) as {
    bankCode?: string; bankName?: string; accountNo?: string;
  };
  if (!bankCode || !bankName || !accountNo || !/^\d{10}$/.test(accountNo)) {
    return NextResponse.json({ error: "Pick your bank and enter a valid 10-digit account number." }, { status: 422 });
  }

  try {
    const resolved = await resolveAccount(accountNo, bankCode);
    const recipient = await createTransferRecipient({ name: resolved.account_name, accountNumber: accountNo, bankCode });
    const v = await prisma.vendor.update({
      where: { id: vendorId },
      data: {
        bankName, bankAccountNo: accountNo, bankAccountName: resolved.account_name,
        bankVerified: true, paystackRecipient: recipient.recipient_code,
      },
    });
    return NextResponse.json({
      bankVerified: true, bankName: v.bankName, accountName: v.bankAccountName, last4: accountNo.slice(-4),
    });
  } catch {
    return NextResponse.json({ error: "We couldn't verify that account. Check the number and bank and try again." }, { status: 422 });
  }
}
