import Link from "next/link";
import { prisma } from "@zyntomax/db";
import { requireSession, accessibleSiteIds } from "@/lib/auth";
import {
  PageHeader, Table, Badge, statusTone, PrimaryLink, EmptyState, formatKg, formatNaira,
} from "@/components/ui";
import { supplierAccount } from "@/lib/suppliers";
import { Plus } from "lucide-react";

export default async function PurchasesPage() {
  const session = await requireSession();
  const siteIds = accessibleSiteIds(session);

  const batches = await prisma.purchaseBatch.findMany({
    where: siteIds ? { siteId: { in: siteIds } } : {},
    include: { supplier: true, items: true, expenses: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Derive each batch's settlement status from its supplier's account (FIFO)
  const supplierIds = [...new Set(batches.map((b) => b.supplierId))];
  const accounts = new Map(
    await Promise.all(supplierIds.map(async (sid) => [sid, await supplierAccount(sid)] as const)),
  );
  const batchStatus = (b: (typeof batches)[number]) =>
    accounts.get(b.supplierId)?.batches[b.id]?.status ?? "UNPAID";

  return (
    <div>
      <PageHeader
        title="Raw material purchases"
        subtitle="Batches from resellers, dumpsites and independent collectors"
        action={
          <PrimaryLink href="/purchases/new">
            <Plus size={15} aria-hidden /> New purchase batch
          </PrimaryLink>
        }
      />

      {batches.length === 0 ? (
        <EmptyState
          title="No purchase batches yet"
          hint="Create a batch when the purchasing manager sets out, then scale it in at the factory."
          action={<PrimaryLink href="/purchases/new">New purchase batch</PrimaryLink>}
        />
      ) : (
        <Table headers={["Lot", "Date", "Supplier", "Scaled weight", "Material cost", "Landed ₦/kg", "Payment"]}>
          {batches.map((b) => {
            const kg = b.items.reduce((s, i) => s + Number(i.weightKg), 0);
            const materialCost = b.items.reduce((s, i) => s + Number(i.amount), 0);
            const expenseCost = b.expenses.reduce((s, e) => s + Number(e.amount), 0);
            const landed = kg > 0 ? (materialCost + expenseCost) / kg : null;
            return (
              <tr key={b.id} className="hover:bg-muted-bg">
                <td className="px-3 py-2">
                  <Link href={`/purchases/${b.id}`} className="tabular font-medium hover:underline">
                    {b.lotNo}
                  </Link>
                </td>
                <td className="px-3 py-2">{b.createdAt.toLocaleDateString("en-NG")}</td>
                <td className="px-3 py-2">{b.supplier.name}</td>
                <td className="tabular px-3 py-2">
                  {b.scaledInAt ? formatKg(kg) : <Badge tone="warning">Not scaled in</Badge>}
                </td>
                <td className="tabular px-3 py-2">{formatNaira(materialCost)}</td>
                <td className="tabular px-3 py-2">{landed ? formatNaira(landed) : "—"}</td>
                <td className="px-3 py-2">
                  <Badge tone={statusTone(batchStatus(b))}>{batchStatus(b)}</Badge>
                </td>
              </tr>
            );
          })}
        </Table>
      )}
    </div>
  );
}
