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

export async function logDiesel(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["FACTORY_SUPERVISOR", "FINANCE_ADMIN", "OPERATIONS_MANAGER"]);
  const raw = Object.fromEntries(formData.entries());
  const parsed = schema.safeParse({ ...raw, cost: raw.cost || undefined });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  await prisma.dieselLog.create({
    data: {
      siteId: d.siteId,
      date: new Date(d.date),
      litres: d.litres,
      cost: d.cost,
      note: d.note,
      recordedById: session.userId,
    },
  });
  await audit({
    actorId: session.userId,
    action: "diesel.log",
    entity: "DieselLog",
    entityId: d.siteId,
    after: { litres: d.litres, date: d.date },
  });
  revalidatePath("/diesel");
  return {};
}

export async function deleteDieselLog(id: string) {
  await requireRole(["FINANCE_ADMIN", "OPERATIONS_MANAGER"]);
  await prisma.dieselLog.delete({ where: { id } });
  revalidatePath("/diesel");
}
