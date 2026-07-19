import Link from "next/link";
import { prisma } from "@zyntomax/db";
import { requireSession } from "@/lib/auth";
import { PageHeader, Table, Card, formatKg, formatNaira, Badge } from "@/components/ui";
import { supplierBalances } from "@/lib/suppliers";
import { SupplierForm } from "./supplier-form";

export default async function SuppliersPage() {
  await requireSession();

  const [suppliers, types] = await Promise.all([
    prisma.supplier.findMany({
      include: {
        type: true,
        purchaseBatches: { include: { items: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.supplierType.findMany({ orderBy: { name: "asc" } }),
  ]);
  const balances = await supplierBalances(suppliers.map((s) => s.id));

  return (
    <div>
      <PageHeader
        title="Suppliers"
        subtitle="Resellers, dumpsites and independent collectors — price and supply history builds over time"
      />

      <Card className="mb-4">
        <h2 className="mb-3 font-medium">Add supplier</h2>
        <SupplierForm types={types.map((t) => ({ id: t.id, name: t.name }))} />
        <p className="mt-2 text-xs text-muted">Manage supplier types in Settings.</p>
      </Card>

      <Table headers={["Supplier", "Type", "Contact", "Batches", "Total supplied", "Delivered value", "Account balance"]}>
        {suppliers.map((s) => {
          const items = s.purchaseBatches.flatMap((b) => b.items);
          const kg = items.reduce((x, i) => x + Number(i.weightKg), 0);
          const acct = balances.get(s.id);
          const bal = acct?.balance ?? 0;
          return (
            <tr key={s.id} className="hover:bg-muted-bg">
              <td className="px-3 py-2 font-medium">
                <Link href={`/suppliers/${s.id}`} className="hover:underline">{s.name}</Link>
              </td>
              <td className="px-3 py-2">{s.type ? <Badge tone="neutral">{s.type.name}</Badge> : "—"}</td>
              <td className="px-3 py-2 text-muted">
                {s.contactPerson ?? "—"}{s.contactPhone ? ` · ${s.contactPhone}` : ""}
              </td>
              <td className="tabular px-3 py-2">{s.purchaseBatches.length}</td>
              <td className="tabular px-3 py-2">{formatKg(kg)}</td>
              <td className="tabular px-3 py-2">{formatNaira(acct?.totalDelivered ?? 0)}</td>
              <td className={`tabular px-3 py-2 font-medium ${bal < -0.01 ? "text-warning" : bal > 0.01 ? "text-accent" : "text-muted"}`}>
                {Math.abs(bal) < 0.01 ? "Settled" : bal > 0 ? `${formatNaira(bal)} credit` : `${formatNaira(-bal)} owed`}
              </td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}
