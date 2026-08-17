import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { verifyPassword } from "@/lib/password";
import { issueVendorToken } from "@/lib/vendor-auth";

export async function POST(request: NextRequest) {
  const { phone, code } = (await request.json()) as { phone?: string; code?: string };
  if (!phone || !code) {
    return NextResponse.json({ error: "Phone and code required." }, { status: 400 });
  }

  const otp = await prisma.vendorOtp.findFirst({
    where: { phone },
    orderBy: { createdAt: "desc" },
  });
  if (!otp || otp.expiresAt < new Date()) {
    return NextResponse.json({ error: "Code expired. Request a new one." }, { status: 401 });
  }
  const ok = await verifyPassword(code, otp.codeHash);
  if (!ok) {
    return NextResponse.json({ error: "Incorrect code." }, { status: 401 });
  }

  const vendor = await prisma.vendor.findUnique({ where: { phone } });
  if (!vendor) return NextResponse.json({ error: "Vendor not found." }, { status: 404 });
  if (vendor.status === "PENDING") {
    return NextResponse.json({ error: "Your account is awaiting approval. We'll notify you once it's approved." }, { status: 403 });
  }
  if (vendor.status !== "ACTIVE") {
    return NextResponse.json({ error: "This account is not active. Please contact Zyntomax." }, { status: 403 });
  }

  await prisma.vendorOtp.deleteMany({ where: { phone } });
  const token = await issueVendorToken(vendor.id);

  return NextResponse.json({
    token,
    vendor: { id: vendor.id, name: vendor.name, vendorNo: vendor.vendorNo, phone: vendor.phone },
  });
}
