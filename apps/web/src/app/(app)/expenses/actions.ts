"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@zyntomax/db";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";

export type FormState = { error?: string };

const expenseSchema = z.object({
  siteId: z.string().min(1),
  categoryId: z.string().min(1),
  amount: z.coerce.number().positive("Enter a valid amount"),
  description: z.string().optional(),
  purchaseBatchId: z.string().optional(),
  tripId: z.string().optional(),
  incurredAt: z.string().optional(),
});

export async function createExpense(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["FINANCE_ADMIN", "OPERATIONS_MANAGER"]);
  const raw = Object.fromEntries(formData.entries());
  const parsed = expenseSchema.safeParse({
    ...raw,
    purchaseBatchId: raw.purchaseBatchId || undefined,
    tripId: raw.tripId || undefined,
    incurredAt: raw.incurredAt || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const expense = await prisma.expense.create({
    data: {
      siteId: data.siteId,
      categoryId: data.categoryId,
      amount: data.amount,
      description: data.description,
      purchaseBatchId: data.purchaseBatchId,
      tripId: data.tripId,
      incurredAt: data.incurredAt ? new Date(data.incurredAt) : new Date(),
      recordedById: session.userId,
    },
  });

  await audit({
    actorId: session.userId,
    action: "expense.create",
    entity: "Expense",
    entityId: expense.id,
    after: { amount: data.amount, categoryId: data.categoryId },
  });

  revalidatePath("/expenses");
  if (data.purchaseBatchId) revalidatePath(`/purchases/${data.purchaseBatchId}`);
  return {};
}

export async function createCategory(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole(["FINANCE_ADMIN"]);
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) return { error: "Enter a category name." };
  const existing = await prisma.expenseCategory.findUnique({ where: { name } });
  if (existing) return { error: "That category already exists." };
  await prisma.expenseCategory.create({ data: { name } });
  revalidatePath("/expenses");
  return {};
}
