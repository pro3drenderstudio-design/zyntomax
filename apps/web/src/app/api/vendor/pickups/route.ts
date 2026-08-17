import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { vendorFromRequest } from "@/lib/vendor-auth";
import { sendSms } from "@/lib/sms";

/** List the vendor's pickup requests (with photo, trip/collector when scheduled). */
export async function GET(request: NextRequest) {
  const vendorId = await vendorFromRequest(request);
  if (!vendorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const requests = await prisma.pickupRequest.findMany({
    where: { vendorId },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { trip: { include: { lead: { include: { user: true } }, locality: true } } },
  });
  return NextResponse.json({
    pickups: requests.map((r) => ({
      id: r.id,
      estWeightKg: r.estWeightKg === null ? null : Number(r.estWeightKg),
      photoUrl: r.photoUrl,
      note: r.note,
      status: r.status,
      createdAt: r.createdAt,
      trip: r.trip
        ? {
            id: r.trip.id,
            date: r.trip.date,
            status: r.trip.status,
            vehicle: r.trip.vehicle,
            collector: r.trip.lead?.user.name ?? null,
          }
        : null,
    })),
  });
}

/** Create a pickup request. A photo is required; weight & note are optional. */
export async function POST(request: NextRequest) {
  const vendorId = await vendorFromRequest(request);
  if (!vendorId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as {
    photoUrl?: string; estWeightKg?: number; note?: string; lat?: number; lng?: number;
  };
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
  if (!vendor) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!body.photoUrl) {
    return NextResponse.json({ error: "A photo of the recyclables is required." }, { status: 422 });
  }

  // Avoid duplicate open requests
  const existing = await prisma.pickupRequest.findFirst({
    where: { vendorId, status: { in: ["PENDING", "SCHEDULED"] } },
  });
  if (existing) {
    return NextResponse.json({ error: "You already have a pending pickup request." }, { status: 409 });
  }

  const req = await prisma.pickupRequest.create({
    data: {
      vendorId,
      estWeightKg: body.estWeightKg && body.estWeightKg > 0 ? body.estWeightKg : null,
      photoUrl: body.photoUrl,
      note: body.note?.trim() || null,
      lat: body.lat ?? vendor.lat,
      lng: body.lng ?? vendor.lng,
      source: "APP",
      status: "PENDING",
    },
  });
  const weightText = req.estWeightKg ? ` (~${Number(req.estWeightKg)}kg)` : "";
  await sendSms({
    to: vendor.phone,
    vendorId,
    body: `Zyntomax: your pickup request${weightText} is received. We'll come to you soon.`,
  });

  return NextResponse.json({ id: req.id, status: req.status });
}
