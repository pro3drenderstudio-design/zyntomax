import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@zyntomax/db";
import { mobileSession, mobileHasRole } from "@/lib/mobile-auth";
import { audit } from "@/lib/audit";

const ROLES = ["FINANCE_ADMIN", "OPERATIONS_MANAGER"] as const;

/** Recent expenses + this month's total + the options needed to record one. */
export async function GET(request: NextRequest) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mobileHasRole(session, [...ROLES])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const [rows, categories, sites, monthAgg] = await Promise.all([
    prisma.expense.findMany({ include: { category: true, site: true }, orderBy: { incurredAt: "desc" }, take: 60 }),
    prisma.expenseCategory.findMany({ orderBy: { name: "asc" } }),
    prisma.site.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.expense.aggregate({ _sum: { amount: true }, where: { incurredAt: { gte: monthStart } } }),
  ]);

  return NextResponse.json({
    monthTotal: Number(monthAgg._sum.amount ?? 0),
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    sites: sites.map((s) => ({ id: s.id, name: s.name })),
    expenses: rows.map((e) => ({
      id: e.id,
      amount: Number(e.amount),
      category: e.category.name,
      site: e.site.name,
      description: e.description,
      incurredAt: e.incurredAt,
    })),
  });
}

const createSchema = z.object({
  siteId: z.string().min(1),
  categoryId: z.string().min(1),
  amount: z.coerce.number().positive("Enter a valid amount"),
  description: z.string().optional(),
  receiptUrl: z.string().optional(),
  incurredAt: z.string().optional(),
});

/** Record an expense from mobile. */
export async function POST(request: NextRequest) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mobileHasRole(session, [...ROLES])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 });
  const data = parsed.data;

  const expense = await prisma.expense.create({
    data: {
      siteId: data.siteId,
      categoryId: data.categoryId,
      amount: data.amount,
      description: data.description,
      receiptUrl: data.receiptUrl,
      incurredAt: data.incurredAt ? new Date(data.incurredAt) : new Date(),
      recordedById: session.userId,
    },
  });
  await audit({ actorId: session.userId, action: "expense.create", entity: "Expense", entityId: expense.id, after: { amount: data.amount, categoryId: data.categoryId } });

  return NextResponse.json({ id: expense.id });
}
