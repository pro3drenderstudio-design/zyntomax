"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@zyntomax/db";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";

export type FormState = { error?: string };

const customerSchema = z.object({
  name: z.string().min(2),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  creditTermsDays: z.coerce.number().int().min(0).max(120).default(0),
});

export async function createCustomer(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["SALES_ADMIN", "FINANCE_ADMIN", "OPERATIONS_MANAGER"]);
  const parsed = customerSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const customer = await prisma.customer.create({
    data: { ...parsed.data, email: parsed.data.email || undefined },
  });
  await audit({
    actorId: session.userId,
    action: "customer.create",
    entity: "Customer",
    entityId: customer.id,
    after: { name: customer.name },
  });
  revalidatePath("/customers");
  return {};
}

export async function setListPrice(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["SALES_ADMIN", "FINANCE_ADMIN"]);
  const materialTypeId = String(formData.get("materialTypeId") ?? "");
  const price = Number(formData.get("pricePerKg"));
  if (!materialTypeId || !price || price <= 0) return { error: "Enter a valid price." };

  await prisma.priceList.create({
    data: { materialTypeId, pricePerKg: price },
  });
  await audit({
    actorId: session.userId,
    action: "price.set",
    entity: "MaterialType",
    entityId: materialTypeId,
    after: { pricePerKg: price },
  });
  revalidatePath("/customers");
  revalidatePath("/orders");
  return {};
}
