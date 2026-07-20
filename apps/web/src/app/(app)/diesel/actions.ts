"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@zyntomax/db";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";

export type FormState = { error?: string };

const schema = z.object({
  siteId: z.string().min(1),
  date: z.string().min(1),
  litres: z.coerce.number().positive("Enter litres used"),
  cost: z.coerce.number().min(0).optional(),
  note: z.string().optional(),
});

export async function dieselAvailable(siteId: string): Promise<number> {
  const rows = await prisma.dieselLog.groupBy({ by: ["kind"], where: { siteId }, _sum: { litres: true } });
  let purchased = 0, used = 0;
  for (const r of rows) {
    if (r.kind === "PURCHASE") purchased = Number(r._sum.litres ?? 0);
    else used = Number(r._sum.litres ?? 0);
  }
  return purchased - used;
}

/** Record a diesel PURCHASE (adds to available litres). */
export async function logDieselPurchase(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["FINANCE_ADMIN", "OPERATIONS_MANAGER"]);
  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse({ ...raw, cost: raw.cost || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const log = await prisma.dieselLog.create({
    data: { siteId: d.siteId, kind: "PURCHASE", date: new Date(d.date), litres: d.litres, cost: d.cost, note: d.note, recordedById: session.userId },
  });
  await audit({ actorId: session.userId, action: "diesel.purchase", entity: "DieselLog", entityId: log.id, after: { litres: d.litres, cost: d.cost } });
  revalidatePath("/diesel");
  return {};
}

/** Record diesel USAGE (drawn from available litres). */
export async function logDiesel(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["FACTORY_SUPERVISOR", "FINANCE_ADMIN", "OPERATIONS_MANAGER"]);
  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse({ ...raw, cost: raw.cost || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const avail = await dieselAvailable(d.siteId);
  if (d.litres > avail + 0.001) return { error: `Only ${avail.toFixed(1)} L available — record a purchase first.` };

  const log = await prisma.dieselLog.create({
    data: { siteId: d.siteId, kind: "USAGE", date: new Date(d.date), litres: d.litres, cost: d.cost, note: d.note, recordedById: session.userId },
  });
  await audit({ actorId: session.userId, action: "diesel.usage", entity: "DieselLog", entityId: log.id, after: { litres: d.litres, date: d.date } });
  revalidatePath("/diesel");
  return {};
}

export async function deleteDieselLog(id: string) {
  await requireRole(["FINANCE_ADMIN", "OPERATIONS_MANAGER"]);
  await prisma.dieselLog.delete({ where: { id } });
  revalidatePath("/diesel");
}
