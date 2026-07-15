"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@zyntomax/db";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";

export type FormState = { error?: string };

const supplierSchema = z.object({
  name: z.string().min(2),
  kind: z.enum(["INDEPENDENT_COLLECTOR", "DUMPSITE", "RESELLER"]),
  phone: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNo: z.string().optional(),
  bankAccountName: z.string().optional(),
  notes: z.string().optional(),
});

export async function createSupplier(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["PURCHASING_MANAGER", "OPERATIONS_MANAGER"]);
  const parsed = supplierSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supplier = await prisma.supplier.create({ data: parsed.data });
  await audit({
    actorId: session.userId,
    action: "supplier.create",
    entity: "Supplier",
    entityId: supplier.id,
    after: { name: supplier.name },
  });
  revalidatePath("/suppliers");
  return {};
}
