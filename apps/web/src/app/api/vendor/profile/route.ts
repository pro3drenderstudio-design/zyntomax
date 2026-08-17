import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { vendorFromRequest } from "@/lib/vendor-auth";

/** Vendor self-service profile edit (name, nickname, address, photo). */
export async function PATCH(request: NextRequest) {
  const vendorId = await vendorFromRequest(request);
  if (!vendorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { name?: string; nickname?: string; address?: string; photoUrl?: string };
  const data: Record<string, string | null> = {};
  if (typeof body.name === "string" && body.name.trim().length >= 2) data.name = body.name.trim();
  if (typeof body.nickname === "string") data.nickname = body.nickname.trim() || null;
  if (typeof body.address === "string") data.address = body.address.trim() || null;
  if (typeof body.photoUrl === "string" && body.photoUrl) data.photoUrl = body.photoUrl;

  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });

  const v = await prisma.vendor.update({ where: { id: vendorId }, data });
  return NextResponse.json({
    vendor: { id: v.id, name: v.name, nickname: v.nickname, phone: v.phone, address: v.address, photoUrl: v.photoUrl },
  });
}
