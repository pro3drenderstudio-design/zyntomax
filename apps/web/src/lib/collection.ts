import { prisma } from "@zyntomax/db";
import { siteLocation } from "./inventory";

export type WeighInInput = {
  clientUuid: string;
  tripId: string;
  vendorId: string;
  materialTypeId: string;
  weightKg: number;
  lat?: number;
  lng?: number;
  photoUrl?: string;
  signatureUrl?: string;
  agentId: string;
};

export type WeighInResult =
  | { ok: true; id: string; amount: number; deduped: boolean }
  | { ok: false; error: string };

/**
 * Core weigh-in logic shared by the admin server action and the mobile API.
 * Idempotent on clientUuid so the offline queue can retry safely.
 */
export async function recordWeighIn(input: WeighInInput): Promise<WeighInResult> {
  const existing = await prisma.collectionWeighIn.findUnique({
    where: { clientUuid: input.clientUuid },
  });
  if (existing) {
    return { ok: true, id: existing.id, amount: Number(existing.amount), deduped: true };
  }

  const trip = await prisma.trip.findUnique({ where: { id: input.tripId } });
  if (!trip) return { ok: false, error: "Trip not found." };
  if (!["PLANNED", "IN_PROGRESS"].includes(trip.status)) {
    return { ok: false, error: "Weigh-ins can only be added while the trip is in the field." };
  }
  if (input.weightKg <= 0) return { ok: false, error: "Weight must be positive." };

  const rate = await prisma.vendorRate.findFirst({
    where: { materialTypeId: input.materialTypeId, effectiveFrom: { lte: new Date() } },
    orderBy: { effectiveFrom: "desc" },
  });
  if (!rate) return { ok: false, error: "No vendor rate set for this material." };

  const amount = input.weightKg * Number(rate.pricePerKg);
  const [gate, vehicle] = await Promise.all([
    siteLocation(trip.siteId, "VENDOR_GATE"),
    siteLocation(trip.siteId, "VEHICLE"),
  ]);

  const [weighIn] = await prisma.$transaction([
    prisma.collectionWeighIn.create({
      data: {
        clientUuid: input.clientUuid,
        tripId: input.tripId,
        vendorId: input.vendorId,
        materialTypeId: input.materialTypeId,
        weightKg: input.weightKg,
        ratePerKg: rate.pricePerKg,
        amount,
        lat: input.lat,
        lng: input.lng,
        photoUrl: input.photoUrl,
        signatureUrl: input.signatureUrl,
        agentId: input.agentId,
        confirmation: input.signatureUrl ? "SIGNATURE" : "NONE",
      },
    }),
    prisma.inventoryMovement.create({
      data: {
        fromLocationId: gate.id,
        toLocationId: vehicle.id,
        materialTypeId: input.materialTypeId,
        weightKg: input.weightKg,
        refType: "TRIP",
        refId: input.tripId,
        byId: input.agentId,
      },
    }),
    ...(trip.status === "PLANNED"
      ? [prisma.trip.update({ where: { id: input.tripId }, data: { status: "IN_PROGRESS" } })]
      : []),
  ]);

  await prisma.pickupRequest.updateMany({
    where: { tripId: input.tripId, vendorId: input.vendorId, status: "SCHEDULED" },
    data: { status: "COLLECTED" },
  });

  return { ok: true, id: weighIn.id, amount, deduped: false };
}
