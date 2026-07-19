import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@zyntomax/db";
import { requireSession, hasRole } from "@/lib/auth";
import {
  PageHeader, Card, Badge, statusTone, Table, StatCard, formatKg, formatNaira,
} from "@/components/ui";
import { supplierAccount } from "@/lib/suppliers";
import { ScaleInForm } from "./scale-in-form";
import { SupplierPaymentForm } from "../../suppliers/payment-form";

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
      expenses: { include: { category: true } },
    },
  });
  if (!batch) notFound();

  const [materials, account] = await Promise.all([
    prisma.materialType.findMany({ where: { active: true }, select: { id: true, name: true } }),
    supplierAccount(batch.supplierId),
  ]);

  const scaledKg = batch.items.reduce((s, i) => s + Number(i.weightKg), 0);
  const materialCost = batch.items.reduce((s, i) => s + Number(i.amount), 0);
  const expenseCost = batch.expenses.reduce((s, e) => s + Number(e.amount), 0);
  const landed = scaledKg > 0 ? (materialCost + expenseCost) / scaledKg : null;
  const estVariance =
    batch.fieldEstKg && scaledKg > 0
      ? ((Number(batch.fieldEstKg) - scaledKg) / Number(batch.fieldEstKg)) * 100
      : null;

  const settlement = account.batches[batch.id];
  const status = settlement?.status ?? "UNPAID";

  const canSupervise = hasRole(session, ["FACTORY_SUPERVISOR", "OPERATIONS_MANAGER"], batch.siteId);
  const canPay = hasRole(session, ["FINANCE_ADMIN", "PURCHASING_MANAGER"], batch.siteId);

  return (
    <div>
      <PageHeader
        title={batch.lotNo}
        subtitle={`${batch.supplier.name} · created ${batch.createdAt.toLocaleString("en-NG")}`}
        action={<Badge tone={statusTone(status)}>{status}</Badge>}
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
        <StatCard label="Landed cost" value={landed ? `${formatNaira(landed)}/kg` : "—"} tone="accent" />
        <StatCard
          label="Covered by account"
          value={formatNaira(settlement?.covered ?? 0)}
          hint={materialCost > 0 ? `of ${formatNaira(materialCost)}` : undefined}
          tone={settlement && settlement.outstanding <= 0.01 ? "accent" : "default"}
        />
        <StatCard
          label="Outstanding on batch"
          value={formatNaira(settlement?.outstanding ?? materialCost)}
          tone={(settlement?.outstanding ?? materialCost) > 0.01 ? "warning" : "default"}
        />
      </div>

      {/* Supplier account context */}
      <Card className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          <Link href={`/suppliers/${batch.supplierId}`} className="font-medium text-accent hover:underline">
            {batch.supplier.name}
          </Link>{" "}
          account —{" "}
          {account.credit > 0.01 ? (
            <span className="text-accent">{formatNaira(account.credit)} prepaid credit available</span>
          ) : account.owed > 0.01 ? (
            <span className="text-warning">{formatNaira(account.owed)} owed to supplier</span>
          ) : (
            <span className="text-muted">settled</span>
          )}
        </p>
        <p className="tabular text-xs text-muted">
          Paid {formatNaira(account.totalPaid)} · Delivered {formatNaira(account.totalDelivered)}
        </p>
      </Card>

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
        </>
      )}

      {canPay && (
        <>
          <h2 className="mb-2 mt-6 font-medium">Pay supplier (against this batch)</h2>
          <Card>
            <SupplierPaymentForm supplierId={batch.supplierId} batchId={batch.id} submitLabel="Record payment" />
            <p className="mt-2 text-xs text-muted">
              Payments go to {batch.supplier.name}&apos;s account and settle deliveries oldest-first — any
              existing advance already covers this batch automatically.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
