import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { mobileSession, mobileHasRole } from "@/lib/mobile-auth";
import { accessibleSiteIds } from "@/lib/auth";
import { supplierAccount } from "@/lib/suppliers";

const ROLES = ["PURCHASING_MANAGER", "FINANCE_ADMIN", "FACTORY_SUPERVISOR", "OPERATIONS_MANAGER"] as const;

/** Raw-material purchase batches with landed cost + settlement status. */
export async function GET(request: NextRequest) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mobileHasRole(session, [...ROLES])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const siteIds = accessibleSiteIds(session);
  const batches = await prisma.purchaseBatch.findMany({
    where: siteIds ? { siteId: { in: siteIds } } : {},
    include: { supplier: true, items: true, expenses: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const supplierIds = [...new Set(batches.map((b) => b.supplierId))];
  const accounts = new Map(
    await Promise.all(supplierIds.map(async (sid) => [sid, await supplierAccount(sid)] as const)),
  );

  return NextResponse.json({
    batches: batches.map((b) => {
      const kg = b.items.reduce((s, i) => s + Number(i.weightKg), 0);
      const materialCost = b.items.reduce((s, i) => s + Number(i.amount), 0);
      const expenseCost = b.expenses.reduce((s, e) => s + Number(e.amount), 0);
      const landed = kg > 0 ? (materialCost + expenseCost) / kg : null;
      return {
        id: b.id,
        lotNo: b.lotNo,
        supplier: b.supplier.name,
        scaledIn: b.scaledInAt !== null,
        kg,
        materialCost,
        landed,
        status: accounts.get(b.supplierId)?.batches[b.id]?.status ?? "UNPAID",
        createdAt: b.createdAt,
      };
    }),
  });
}
