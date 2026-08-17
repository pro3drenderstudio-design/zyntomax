import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { vendorFromRequest } from "@/lib/vendor-auth";

function makeCode(name: string): string {
  const base = name.replace(/[^a-zA-Z]/g, "").slice(0, 4).toUpperCase() || "ZYN";
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}${rand}`;
}

/** Vendor's referral code + how many vendors they've referred. Generates a code on first call. */
export async function GET(request: NextRequest) {
  const vendorId = await vendorFromRequest(request);
  if (!vendorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!vendor.referralCode) {
    for (let i = 0; i < 5; i++) {
      const code = makeCode(vendor.name);
      try {
        vendor = await prisma.vendor.update({ where: { id: vendorId }, data: { referralCode: code } });
        break;
      } catch { /* collision, retry */ }
    }
  }

  const referredCount = await prisma.vendor.count({ where: { referredByCode: vendor.referralCode ?? "__none__" } });
  return NextResponse.json({ code: vendor.referralCode, referredCount });
}
