"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@zyntomax/db";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { sendSms } from "@/lib/sms";
import { sendExpoPush } from "@/lib/push";

const COLLECTION_ROLES = ["OPERATIONS_MANAGER", "FACTORY_SUPERVISOR", "TEAM_LEAD"] as const;

/** Assign a pending pickup to an active trip → dispatched to a collector. */
export async function schedulePickup(pickupId: string, tripId: string): Promise<void> {
  const session = await requireRole([...COLLECTION_ROLES]);
  if (!tripId) return;
  const [pickup, trip] = await Promise.all([
    prisma.pickupRequest.findUniqueOrThrow({ where: { id: pickupId }, include: { vendor: true } }),
    prisma.trip.findUniqueOrThrow({ where: { id: tripId }, include: { lead: { include: { user: true } } } }),
  ]);
  if (pickup.status !== "PENDING") return;
  if (!["PLANNED", "IN_PROGRESS"].includes(trip.status)) return;

  await prisma.pickupRequest.update({ where: { id: pickupId }, data: { status: "SCHEDULED", tripId } });
  const collector = trip.lead?.user.name;
  await sendSms({
    to: pickup.vendor.phone,
    vendorId: pickup.vendorId,
    body: `Zyntomax: a collector${collector ? ` (${collector})` : ""} has been scheduled for your pickup. We'll be there soon.`,
  });
  await sendExpoPush(pickup.vendor.pushToken, "Pickup scheduled 🚛", "A collector is on the way for your recyclables. Track them in the app.", { pickupId });
  await audit({ actorId: session.userId, action: "pickup.schedule", entity: "PickupRequest", entityId: pickupId, after: { tripId } });
  revalidatePath("/pickups");
  revalidatePath(`/pickups/${pickupId}`);
  revalidatePath(`/trips/${tripId}`);
}

/** Return a scheduled pickup to the pending pool (detach from its trip). */
export async function unschedulePickup(pickupId: string): Promise<void> {
  const session = await requireRole([...COLLECTION_ROLES]);
  const pickup = await prisma.pickupRequest.findUniqueOrThrow({ where: { id: pickupId } });
  if (pickup.status !== "SCHEDULED") return;
  await prisma.pickupRequest.update({ where: { id: pickupId }, data: { status: "PENDING", tripId: null } });
  await audit({ actorId: session.userId, action: "pickup.unschedule", entity: "PickupRequest", entityId: pickupId });
  revalidatePath("/pickups");
  revalidatePath(`/pickups/${pickupId}`);
}

/** Cancel a pickup request (not allowed once collected). */
export async function cancelPickup(pickupId: string): Promise<void> {
  const session = await requireRole([...COLLECTION_ROLES]);
  const pickup = await prisma.pickupRequest.findUniqueOrThrow({ where: { id: pickupId }, include: { vendor: true } });
  if (pickup.status === "COLLECTED") return;
  await prisma.pickupRequest.update({ where: { id: pickupId }, data: { status: "CANCELLED", tripId: null } });
  await sendSms({ to: pickup.vendor.phone, vendorId: pickup.vendorId, body: "Zyntomax: your pickup request has been cancelled. Please contact us if you have any questions." });
  await sendExpoPush(pickup.vendor.pushToken, "Pickup cancelled", "Your pickup request was cancelled.", { pickupId });
  await audit({ actorId: session.userId, action: "pickup.cancel", entity: "PickupRequest", entityId: pickupId });
  revalidatePath("/pickups");
  revalidatePath(`/pickups/${pickupId}`);
}
