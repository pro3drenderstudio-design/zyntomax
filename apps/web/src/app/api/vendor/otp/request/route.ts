import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { hashPassword } from "@/lib/password";
import { sendSms } from "@/lib/sms";

/** Send a login OTP to a registered vendor's phone. */
export async function POST(request: NextRequest) {
  const { phone } = (await request.json()) as { phone?: string };
  if (!phone || !/^0\d{10}$/.test(phone)) {
    return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
  }

  const vendor = await prisma.vendor.findUnique({ where: { phone } });
  // Do not reveal whether the number is registered
  if (!vendor || vendor.status === "BLACKLISTED") {
    return NextResponse.json({ ok: true });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const codeHash = await hashPassword(code);
  await prisma.vendorOtp.deleteMany({ where: { phone } });
  await prisma.vendorOtp.create({
    data: { phone, codeHash, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  });

  await sendSms({
    to: phone,
    vendorId: vendor.id,
    body: `Your Zyntomax login code is ${code}. It expires in 10 minutes.`,
  });

  // In dev (no SMS provider) surface the code so the flow is testable
  const devHint = process.env.TERMII_API_KEY ? undefined : code;
  return NextResponse.json({ ok: true, devCode: devHint });
}
