import { notFound } from "next/navigation";
import { prisma } from "@zyntomax/db";
import { requireSession, hasRole } from "@/lib/auth";
import {
  PageHeader, Card, Badge, statusTone, Table, StatCard, formatKg, formatNaira,
} from "@/components/ui";
import { ScaleInForm } from "./scale-in-form";
import { PaymentForm } from "./payment-form";

export default async function PurchaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const batch = await prisma.purchaseBatch.findUnique({
    where: { id },
    include: {
      supplier: true,
      items: { include: { materialType: true } },
      supplierPayments: { orderBy: { paidAt: "desc" } },
      expenses: { include: { category: true } },
    },
  });
  if (!batch) notFound();

  const materials = await prisma.materialType.findMany({
    where: { active: true },
    select: { id: true, name: true },
  });

  const scaledKg = batch.items.reduce((s, i) => s + Number(i.weightKg), 0);
  const materialCost = batch.items.reduce((s, i) => s + Number(i.amount), 0);
  const expenseCost = batch.expenses.reduce((s, e) => s + Number(e.amount), 0);
  const paid = batch.supplierPayments.reduce((s, p) => s + Number(p.amount), 0);
  const landed = scaledKg > 0 ? (materialCost + expenseCost) / scaledKg : null;
  const estVariance =
    batch.fieldEstKg && scaledKg > 0
      ? ((Number(batch.fieldEstKg) - scaledKg) / Number(batch.fieldEstKg)) * 100
      : null;

  const canSupervise = hasRole(session, ["FACTORY_SUPERVISOR", "OPERATIONS_MANAGER"], batch.siteId);
  const canPay = hasRole(session, ["FINANCE_ADMIN", "PURCHASING_MANAGER"], batch.siteId);

  return (
    <div>
      <PageHeader
        title={batch.lotNo}
        subtitle={`${batch.supplier.name} · created ${batch.createdAt.toLocaleString("en-NG")}`}
        action={<Badge tone={statusTone(batch.paymentStatus)}>{batch.paymentStatus}</Badge>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard
          label="Scaled-in weight"
          value={batch.scaledInAt ? formatKg(scaledKg) : "Pending"}
          hint={
            batch.fieldEstKg
              ? `Field estimate: ${formatKg(Number(batch.fieldEstKg))}${
                  estVariance !== null ? ` (${estVariance > 0 ? "−" : "+"}${Math.abs(estVariance).toFixed(1)}%)` : ""
                }`
              : undefined
          }
        />
        <StatCard label="Material cost" value={formatNaira(materialCost)} />
        <StatCard label="Linked expenses" value={formatNaira(expenseCost)} hint="Logistics, loading…" />
        <StatCard
          label="Landed cost"
          value={landed ? `${formatNaira(landed)}/kg` : "—"}
          tone="accent"
        />
        <StatCard
          label="Paid to supplier"
          value={formatNaira(paid)}
          hint={materialCost > 0 ? `of ${formatNaira(materialCost)}` : undefined}
          tone={paid >= materialCost && materialCost > 0 ? "accent" : "warning"}
        />
      </div>

      {!batch.scaledInAt && canSupervise && (
        <Card className="mt-4">
          <h2 className="mb-1 font-medium">Scale in at factory</h2>
          <p className="mb-3 text-sm text-muted">
            One line per material type on the truck. Weights go straight into raw material inventory under lot {batch.lotNo}.
          </p>
          <ScaleInForm batchId={batch.id} materials={materials} />
        </Card>
      )}

      {batch.items.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 font-medium">Scaled-in materials</h2>
          <Table headers={["Material", "Weight", "Price/kg", "Amount"]}>
            {batch.items.map((i) => (
              <tr key={i.id}>
                <td className="px-3 py-2 font-medium">{i.materialType.name}</td>
                <td className="tabular px-3 py-2">{formatKg(Number(i.weightKg))}</td>
                <td className="tabular px-3 py-2">{formatNaira(Number(i.pricePerKg))}</td>
                <td className="tabular px-3 py-2 font-medium">{formatNaira(Number(i.amount))}</td>
              </tr>
            ))}
          </Table>
        </>
      )}

      {batch.expenses.length > 0 && (
        <>
          <h2 className="mb-2 mt-6 font-medium">Linked expenses</h2>
          <Table headers={["Date", "Category", "Description", "Amount"]}>
            {batch.expenses.map((e) => (
              <tr key={e.id}>
                <td className="px-3 py-2">{e.incurredAt.toLocaleDateString("en-NG")}</td>
                <td className="px-3 py-2">{e.category.name}</td>
                <td className="px-3 py-2 text-muted">{e.description ?? "—"}</td>
                <td className="tabular px-3 py-2 font-medium">{formatNaira(Number(e.amount))}</td>
              </tr>
            ))}
          </Table>
          <p className="mt-1 text-xs text-muted">
            Add more from the Expenses page and select this batch to tie the cost to it.
          </p>
        </>
      )}

      <h2 className="mb-2 mt-6 font-medium">Supplier payments</h2>
      {canPay && (
        <Card className="mb-3">
          <PaymentForm batchId={batch.id} />
        </Card>
      )}
      {batch.supplierPayments.length === 0 ? (
        <Card><p className="py-4 text-center text-sm text-muted">No payments recorded.</p></Card>
      ) : (
        <Table headers={["Date", "Amount", "Method", "Reference", "Type"]}>
          {batch.supplierPayments.map((p) => (
            <tr key={p.id}>
              <td className="px-3 py-2">{p.paidAt.toLocaleDateString("en-NG")}</td>
              <td className="tabular px-3 py-2 font-medium">{formatNaira(Number(p.amount))}</td>
              <td className="px-3 py-2">{p.method}</td>
              <td className="tabular px-3 py-2 text-xs">{p.reference ?? "—"}</td>
              <td className="px-3 py-2">{p.isAdvance ? <Badge tone="info">Advance</Badge> : "Payment"}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
