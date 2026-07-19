import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { vendorFromRequest } from "@/lib/vendor-auth";
import { getSetting } from "@/lib/settings";
import { sendSms } from "@/lib/sms";

/** List the vendor's pickup requests. */
export async function GET(request: NextRequest) {
  const vendorId = await vendorFromRequest(request);
  if (!vendorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requests = await prisma.pickupRequest.findMany({
    where: { vendorId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });
  return NextResponse.json({
    pickups: requests.map((r) => ({
      id: r.id, estWeightKg: Number(r.estWeightKg), status: r.status, createdAt: r.createdAt,
    })),
  });
}

/** Create a pickup request (enforces the admin-set minimum weight). */
export async function POST(request: NextRequest) {
  const vendorId = await vendorFromRequest(request);
  if (!vendorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { estWeightKg } = (await request.json()) as { estWeightKg?: number };
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const minKg = await getSetting<number>("collection.min_pickup_kg", 20, vendor.siteId);
  if (!estWeightKg || estWeightKg < minKg) {
    return NextResponse.json({ error: `Pickups need at least ${minKg} kg.` }, { status: 422 });
  }

  // Avoid duplicate open requests
  const existing = await prisma.pickupRequest.findFirst({
    where: { vendorId, status: { in: ["PENDING", "SCHEDULED"] } },
  });
  if (existing) {
    return NextResponse.json({ error: "You already have a pending pickup request." }, { status: 409 });
  }

  const req = await prisma.pickupRequest.create({
    data: { vendorId, estWeightKg, source: "APP", status: "PENDING" },
  });
  await sendSms({
    to: vendor.phone,
    vendorId,
    body: `Zyntomax: your pickup request (~${estWeightKg}kg) is received. We'll come to you soon.`,
  });

  return NextResponse.json({ id: req.id, status: req.status });
}
