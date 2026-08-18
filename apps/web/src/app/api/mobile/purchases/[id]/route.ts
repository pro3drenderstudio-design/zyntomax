import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { mobileSession, mobileHasRole } from "@/lib/mobile-auth";
import { supplierAccount } from "@/lib/suppliers";

/** Purchase batch detail: scaled-in items, linked expenses, settlement. */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mobileHasRole(session, ["PURCHASING_MANAGER", "FINANCE_ADMIN", "FACTORY_SUPERVISOR", "OPERATIONS_MANAGER"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { id } = await ctx.params;

  const b = await prisma.purchaseBatch.findUnique({
    where: { id },
    include: { supplier: true, items: { include: { materialType: true } }, expenses: { include: { category: true } } },
  });
  if (!b) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const account = await supplierAccount(b.supplierId);
  const settlement = account.batches[b.id];
  const kg = b.items.reduce((s, i) => s + Number(i.weightKg), 0);
  const materialCost = b.items.reduce((s, i) => s + Number(i.amount), 0);
  const expenseCost = b.expenses.reduce((s, e) => s + Number(e.amount), 0);
  const fieldEst = b.fieldEstKg === null ? null : Number(b.fieldEstKg);

  return NextResponse.json({
    id: b.id,
    lotNo: b.lotNo,
    supplier: { name: b.supplier.name, phone: b.supplier.phone },
    scaledIn: b.scaledInAt !== null,
    scaledInAt: b.scaledInAt,
    fieldEstKg: fieldEst,
    kg,
    variancePct: fieldEst && fieldEst > 0 && b.scaledInAt ? ((kg - fieldEst) / fieldEst) * 100 : null,
    materialCost,
    expenseCost,
    landed: kg > 0 ? (materialCost + expenseCost) / kg : null,
    covered: settlement ? settlement.covered : 0,
    outstanding: settlement ? settlement.outstanding : materialCost,
    status: settlement?.status ?? "UNPAID",
    items: b.items.map((i) => ({ name: i.materialType.name, weightKg: Number(i.weightKg), pricePerKg: Number(i.pricePerKg), amount: Number(i.amount) })),
    expenses: b.expenses.map((e) => ({ category: e.category.name, description: e.description, amount: Number(e.amount), incurredAt: e.incurredAt })),
  });
}
