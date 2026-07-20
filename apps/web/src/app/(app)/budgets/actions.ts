"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@zyntomax/db";
import { requireRole } from "@/lib/auth";

export type FormState = { error?: string };

export async function setBudget(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole(["FINANCE_ADMIN"]);
  const categoryId = String(formData.get("categoryId") ?? "");
  const amount = Number(formData.get("amount"));
  const period = String(formData.get("period") ?? ""); // yyyy-MM
  if (!categoryId || !amount || amount <= 0 || !/^\d{4}-\d{2}$/.test(period)) {
    return { error: "Pick a category, month, and a valid amount." };
  }
  const [year, month] = period.split("-").map(Number);

  const existing = await prisma.budget.findFirst({
    where: { siteId: null, categoryId, periodYear: year, periodMonth: month },
  });
  if (existing) {
    await prisma.budget.update({ where: { id: existing.id }, data: { amount } });
  } else {
    await prisma.budget.create({
      data: { categoryId, periodYear: year, periodMonth: month, amount },
    });
  }
  revalidatePath("/budgets");
  return {};
}

export async function deleteBudget(id: string) {
  await requireRole(["FINANCE_ADMIN"]);
  await prisma.budget.delete({ where: { id } });
  revalidatePath("/budgets");
}

export async function deleteTarget(id: string) {
  await requireRole(["FINANCE_ADMIN", "OPERATIONS_MANAGER"]);
  await prisma.target.delete({ where: { id } });
  revalidatePath("/budgets");
  revalidatePath("/");
}

export async function setTarget(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireRole(["FINANCE_ADMIN", "OPERATIONS_MANAGER"]);
  const metric = String(formData.get("metric") ?? "");
  const value = Number(formData.get("value"));
  const period = String(formData.get("period") ?? "");
  if (
    !["FINISHED_OUTPUT_KG", "COLLECTION_KG", "PURCHASE_KG", "SALES_NAIRA"].includes(metric) ||
    !value || value <= 0 || !/^\d{4}-\d{2}$/.test(period)
  ) {
    return { error: "Pick a metric, month, and a valid value." };
  }
  const [year, month] = period.split("-").map(Number);

  const existing = await prisma.target.findFirst({
    where: {
      siteId: null,
      materialTypeId: null,
      metric: metric as never,
      periodYear: year,
      periodMonth: month,
    },
  });
  if (existing) {
    await prisma.target.update({ where: { id: existing.id }, data: { value } });
  } else {
    await prisma.target.create({
      data: {
        metric: metric as never,
        periodYear: year,
        periodMonth: month,
        value,
      },
    });
  }
  revalidatePath("/budgets");
  revalidatePath("/reports");
  revalidatePath("/");
  return {};
}
