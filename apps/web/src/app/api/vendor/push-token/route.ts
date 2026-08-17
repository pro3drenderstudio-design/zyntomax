import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { vendorFromRequest } from "@/lib/vendor-auth";

/** Register the vendor's Expo push token for notifications. */
export async function POST(request: NextRequest) {
  const vendorId = await vendorFromRequest(request);
  if (!vendorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { token } = (await request.json()) as { token?: string };
  if (!token) return NextResponse.json({ error: "No token" }, { status: 400 });
  await prisma.vendor.update({ where: { id: vendorId }, data: { pushToken: token } });
  return NextResponse.json({ ok: true });
}
