import Link from "next/link";
import { prisma } from "@zyntomax/db";
import { requireSession } from "@/lib/auth";
import { PageHeader, Table, Card, formatKg, formatNaira, Badge } from "@/components/ui";
import { SupplierForm } from "./supplier-form";

export default async function SuppliersPage() {
  await requireSession();

  const [suppliers, types] = await Promise.all([
    prisma.supplier.findMany({
      include: {
        type: true,
        purchaseBatches: { include: { items: true } },
        prepayments: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.supplierType.findMany({ orderBy: { name: "asc" } }),
  ]);

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

      <Table headers={["Supplier", "Type", "Contact", "Batches", "Total supplied", "Total value", "Prepaid bal."]}>
        {suppliers.map((s) => {
          const items = s.purchaseBatches.flatMap((b) => b.items);
          const kg = items.reduce((x, i) => x + Number(i.weightKg), 0);
          const value = items.reduce((x, i) => x + Number(i.amount), 0);
          const prepaid = s.prepayments.reduce((x, p) => x + Number(p.amount), 0);
          // rough drawn-down = value of batches (paid or on account) — shown fully in detail
          const balance = prepaid;
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
              <td className="tabular px-3 py-2">{formatNaira(value)}</td>
              <td className="tabular px-3 py-2">{prepaid > 0 ? formatNaira(balance) : "—"}</td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}
