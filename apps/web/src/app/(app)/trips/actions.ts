"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@zyntomax/db";
import { z } from "zod";
import { randomUUID } from "crypto";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { getSetting } from "@/lib/settings";
import { siteLocation } from "@/lib/inventory";
import { recordWeighIn } from "@/lib/collection";
import { sendExpoPush } from "@/lib/push";
import { approveTripById } from "@/lib/trips";

export type FormState = { error?: string };

// ── Create trip ────────────────────────────────────────────────────────
const tripSchema = z.object({
  siteId: z.string().min(1),
  localityId: z.string().optional(),
  leadId: z.string().min(1),
  vehicle: z.string().optional(),
  date: z.string().min(1),
});

export async function createTrip(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["OPERATIONS_MANAGER", "TEAM_LEAD"]);

  const raw = Object.fromEntries(formData.entries());
  const parsed = tripSchema.safeParse({
    ...raw,
    localityId: raw.localityId || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const memberIds = formData.getAll("memberIds").map(String).filter(Boolean);

  const trip = await prisma.trip.create({
    data: {
      siteId: parsed.data.siteId,
      localityId: parsed.data.localityId,
      leadId: parsed.data.leadId,
      vehicle: parsed.data.vehicle,
      date: new Date(parsed.data.date),
      members: { create: memberIds.map((staffId) => ({ staffId })) },
    },
  });

  // Attach pending pickup requests from the trip's locality
  if (parsed.data.localityId) {
    const scheduling = await prisma.pickupRequest.findMany({
      where: { status: "PENDING", vendor: { localityId: parsed.data.localityId } },
      include: { vendor: true },
    });
    await prisma.pickupRequest.updateMany({
      where: { status: "PENDING", vendor: { localityId: parsed.data.localityId } },
      data: { status: "SCHEDULED", tripId: trip.id },
    });
    for (const p of scheduling) {
      await sendExpoPush(p.vendor.pushToken, "Pickup scheduled 🚛", "A collector is on the way for your recyclables. Track them in the app.", { pickupId: p.id });
    }
  }

  await audit({
    actorId: session.userId,
    action: "trip.create",
    entity: "Trip",
    entityId: trip.id,
    after: { date: parsed.data.date, localityId: parsed.data.localityId },
  });

  revalidatePath("/trips");
  redirect(`/trips/${trip.id}`);
}

// ── Status transitions ─────────────────────────────────────────────────
export async function setTripStatus(
  tripId: string,
  status: "IN_PROGRESS" | "RETURNED" | "CANCELLED",
) {
  const session = await requireRole(["OPERATIONS_MANAGER", "TEAM_LEAD"]);
  const trip = await prisma.trip.findUniqueOrThrow({ where: { id: tripId } });

  const allowed: Record<string, string[]> = {
    IN_PROGRESS: ["PLANNED"],
    RETURNED: ["IN_PROGRESS"],
    CANCELLED: ["PLANNED"],
  };
  if (!allowed[status].includes(trip.status)) {
    throw new Error(`Cannot move trip from ${trip.status} to ${status}`);
  }

  await prisma.trip.update({ where: { id: tripId }, data: { status } });
  await audit({
    actorId: session.userId,
    action: "trip.status",
    entity: "Trip",
    entityId: tripId,
    before: { status: trip.status },
    after: { status },
  });
  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/trips");
}

// ── Weigh-in (office entry; the Field app posts to the same logic) ─────
const weighInSchema = z.object({
  tripId: z.string().min(1),
  vendorId: z.string().min(1),
  materialTypeId: z.string().min(1),
  weightKg: z.coerce.number().positive("Weight must be positive"),
});

export async function addWeighIn(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole([
    "OPERATIONS_MANAGER",
    "TEAM_LEAD",
    "COLLECTION_AGENT",
  ]);

  const parsed = weighInSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { tripId, vendorId, materialTypeId, weightKg } = parsed.data;

  const result = await recordWeighIn({
    clientUuid: randomUUID(),
    tripId,
    vendorId,
    materialTypeId,
    weightKg,
    agentId: session.userId,
  });
  if (!result.ok) return { error: result.error };

  revalidatePath(`/trips/${tripId}`);
  return {};
}

// ── Reconciliation (factory supervisor scales the truck in) ───────────
export async function reconcileTrip(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["FACTORY_SUPERVISOR", "OPERATIONS_MANAGER"]);
  const tripId = String(formData.get("tripId") ?? "");

  const trip = await prisma.trip.findUniqueOrThrow({
    where: { id: tripId },
    include: { weighIns: true },
  });
  if (trip.status !== "RETURNED") {
    return { error: "The trip must be marked as returned before reconciliation." };
  }

  const tolerance = await getSetting<number>("collection.tolerance_pct", 3, trip.siteId);

  // Collected totals per material from field weigh-ins
  const collected = new Map<string, number>();
  for (const w of trip.weighIns) {
    collected.set(
      w.materialTypeId,
      (collected.get(w.materialTypeId) ?? 0) + Number(w.weightKg),
    );
  }
  if (collected.size === 0) return { error: "This trip has no weigh-ins to reconcile." };

  type Item = {
    materialTypeId: string;
    collectedKg: number;
    remittedKg: number;
    variancePct: number;
    reason?: string;
  };
  const items: Item[] = [];
  for (const [materialTypeId, collectedKg] of collected) {
    const remittedRaw = formData.get(`remitted_${materialTypeId}`);
    const remittedKg = Number(remittedRaw);
    if (remittedRaw === null || Number.isNaN(remittedKg) || remittedKg < 0) {
      return { error: "Enter the remitted weight for every material." };
    }
    const variancePct =
      collectedKg === 0 ? 0 : ((collectedKg - remittedKg) / collectedKg) * 100;
    const reason = String(formData.get(`reason_${materialTypeId}`) ?? "").trim();
    if (Math.abs(variancePct) > tolerance && !reason) {
      return {
        error: `Variance for a material exceeds the ${tolerance}% tolerance — a reason is required.`,
      };
    }
    items.push({ materialTypeId, collectedKg, remittedKg, variancePct, reason: reason || undefined });
  }

  const [vehicle, intake, waste, gate] = await Promise.all([
    siteLocation(trip.siteId, "VEHICLE"),
    siteLocation(trip.siteId, "INTAKE"),
    siteLocation(trip.siteId, "WASTE"),
    siteLocation(trip.siteId, "VENDOR_GATE"),
  ]);

  await prisma.$transaction(async (tx) => {
    const rec = await tx.tripReconciliation.create({
      data: {
        tripId,
        items: {
          create: items.map((i) => ({
            materialTypeId: i.materialTypeId,
            collectedKg: i.collectedKg,
            remittedKg: i.remittedKg,
            variancePct: Math.round(i.variancePct * 100) / 100,
            toleranceSnapshot: tolerance,
            varianceReason: i.reason,
          })),
        },
      },
    });

    for (const i of items) {
      // Remitted weight enters the factory
      if (i.remittedKg > 0) {
        await tx.inventoryMovement.create({
          data: {
            fromLocationId: vehicle.id,
            toLocationId: intake.id,
            materialTypeId: i.materialTypeId,
            weightKg: i.remittedKg,
            refType: "TRIP",
            refId: tripId,
            byId: session.userId,
            note: "Factory scale-in",
          },
        });
      }
      const diff = i.collectedKg - i.remittedKg;
      if (diff > 0) {
        // Loss in transit — clears the vehicle, visible in the WASTE ledger
        await tx.inventoryMovement.create({
          data: {
            fromLocationId: vehicle.id,
            toLocationId: waste.id,
            materialTypeId: i.materialTypeId,
            weightKg: diff,
            refType: "TRIP",
            refId: tripId,
            byId: session.userId,
            note: `Collection variance ${i.variancePct.toFixed(1)}%${i.reason ? ` — ${i.reason}` : ""}`,
          },
        });
      } else if (diff < 0) {
        // Gain (e.g. moisture, under-read field scale) — balance the vehicle
        await tx.inventoryMovement.create({
          data: {
            fromLocationId: gate.id,
            toLocationId: vehicle.id,
            materialTypeId: i.materialTypeId,
            weightKg: -diff,
            refType: "TRIP",
            refId: tripId,
            byId: session.userId,
            note: "Reconciliation gain adjustment",
          },
        });
      }
    }

    await tx.trip.update({ where: { id: tripId }, data: { status: "RECONCILED" } });
    void rec;
  });

  await audit({
    actorId: session.userId,
    action: "trip.reconcile",
    entity: "Trip",
    entityId: tripId,
    after: { items },
  });

  revalidatePath(`/trips/${tripId}`);
  return {};
}

// ── Approval → payout batch ────────────────────────────────────────────
export async function approveTrip(tripId: string) {
  const session = await requireRole(["FACTORY_SUPERVISOR", "OPERATIONS_MANAGER"]);
  const result = await approveTripById(tripId, session.userId);
  if (!result.ok) throw new Error(result.error);
  revalidatePath(`/trips/${tripId}`);
  revalidatePath("/payouts");
}
