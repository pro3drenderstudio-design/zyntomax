import { prisma } from "@zyntomax/db";
import { requireSession } from "@/lib/auth";
import { PageHeader, Table, Card, formatKg, formatNaira } from "@/components/ui";
import { SupplierForm } from "./supplier-form";

const KIND_LABEL: Record<string, string> = {
  INDEPENDENT_COLLECTOR: "Independent collector",
  DUMPSITE: "Dumpsite",
  RESELLER: "Reseller",
};

export default async function SuppliersPage() {
  await requireSession();

  const suppliers = await prisma.supplier.findMany({
    include: {
      purchaseBatches: {
        include: { items: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Suppliers"
        subtitle="Resellers, dumpsites and independent collectors — price history builds over time"
      />

      <Card className="mb-4">
        <h2 className="mb-3 font-medium">Add supplier</h2>
        <SupplierForm />
      </Card>

      <Table headers={["Supplier", "Type", "Phone", "Batches", "Total supplied", "Total value"]}>
        {suppliers.map((s) => {
          const items = s.purchaseBatches.flatMap((b) => b.items);
          const kg = items.reduce((x, i) => x + Number(i.weightKg), 0);
          const value = items.reduce((x, i) => x + Number(i.amount), 0);
          return (
            <tr key={s.id}>
              <td className="px-3 py-2 font-medium">{s.name}</td>
              <td className="px-3 py-2">{KIND_LABEL[s.kind]}</td>
              <td className="tabular px-3 py-2">{s.phone ?? "—"}</td>
              <td className="tabular px-3 py-2">{s.purchaseBatches.length}</td>
              <td className="tabular px-3 py-2">{formatKg(kg)}</td>
              <td className="tabular px-3 py-2">{formatNaira(value)}</td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}
