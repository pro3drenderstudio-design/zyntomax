"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@zyntomax/db";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";

export type FormState = { error?: string };

export async function accountBalance(accountId: string): Promise<number> {
  const agg = await prisma.cashTransaction.aggregate({ where: { accountId }, _sum: { amount: true } });
  return Number(agg._sum.amount ?? 0);
}

/** Create a spendable cash/float account (e.g. "Factory expenses"). */
export async function createCashAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole(["FINANCE_ADMIN", "OPERATIONS_MANAGER"]);
  const name = String(formData.get("name") ?? "").trim();
  const siteId = String(formData.get("siteId") ?? "") || null;
  if (name.length < 2) return { error: "Enter an account name." };
  if (!siteId) return { error: "Pick the site this account belongs to." };
  const existing = await prisma.cashAccount.findUnique({ where: { name } });
  if (existing) return { error: "An account with that name already exists." };

  const acc = await prisma.cashAccount.create({ data: { name, siteId } });
  await audit({ actorId: session.userId, action: "account.create", entity: "CashAccount", entityId: acc.id, after: { name } });
  revalidatePath("/accounts");
  return {};
}

/** Fund an account — company money moved into the float (not an expense yet). */
export async function fundAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole(["FINANCE_ADMIN", "OPERATIONS_MANAGER"]);
  const accountId = String(formData.get("accountId") ?? "");
  const amount = Number(formData.get("amount"));
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!accountId || !(amount > 0)) return { error: "Enter a valid funding amount." };

  await prisma.cashTransaction.create({ data: { accountId, kind: "FUNDING", amount, note, recordedById: session.userId } });
  await audit({ actorId: session.userId, action: "account.fund", entity: "CashAccount", entityId: accountId, after: { amount } });
  revalidatePath("/accounts");
  return {};
}

/**
 * Record a spend from the account. Creates a categorised Expense (so P&L /
 * budgets stay correct) AND a linked cash-out transaction (so the balance
 * drops). Funding was never counted as an expense, so nothing double-counts.
 */
export async function spendFromAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole(["FINANCE_ADMIN", "OPERATIONS_MANAGER"]);
  const accountId = String(formData.get("accountId") ?? "");
  const amount = Number(formData.get("amount"));
  const categoryId = String(formData.get("categoryId") ?? "");
  const description = String(formData.get("description") ?? "").trim() || null;
  const date = String(formData.get("date") ?? "");
  if (!accountId || !(amount > 0)) return { error: "Enter a valid amount." };
  if (!categoryId) return { error: "Pick an expense category." };

  const account = await prisma.cashAccount.findUniqueOrThrow({ where: { id: accountId } });
  if (!account.siteId) return { error: "This account has no site set." };
  const bal = await accountBalance(accountId);
  if (amount > bal + 0.001) return { error: `Only ${bal.toLocaleString()} is available in this account.` };

  await prisma.$transaction(async (tx) => {
    const expense = await tx.expense.create({
      data: {
        siteId: account.siteId!,
        categoryId,
        amount,
        description,
        incurredAt: date ? new Date(date) : new Date(),
        recordedById: session.userId,
      },
    });
    await tx.cashTransaction.create({
      data: { accountId, kind: "EXPENSE", amount: -amount, note: description, expenseId: expense.id, recordedById: session.userId },
    });
  });
  await audit({ actorId: session.userId, action: "account.spend", entity: "CashAccount", entityId: accountId, after: { amount, categoryId } });
  revalidatePath("/accounts");
  revalidatePath("/expenses");
  return {};
}
