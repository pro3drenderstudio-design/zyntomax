import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@zyntomax/db";
import { requireSession, hasRole } from "@/lib/auth";
import {
  PageHeader, Card, Table, Badge, statusTone, StatCard, formatKg, formatNaira,
} from "@/components/ui";
import { supplierAccount } from "@/lib/suppliers";
import { SupplierForm } from "../supplier-form";
import { SupplierPaymentForm } from "../payment-form";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const [supplier, types, account, payments] = await Promise.all([
    prisma.supplier.findUnique({
      where: { id },
      include: {
        type: true,
        purchaseBatches: { include: { items: true }, orderBy: { createdAt: "desc" } },
      },
    }),
    prisma.supplierType.findMany({ orderBy: { name: "asc" } }),
    supplierAccount(id),
    prisma.supplierPayment.findMany({ where: { supplierId: id }, orderBy: { paidAt: "desc" } }),
  ]);
  if (!supplier) notFound();

  const canManage = hasRole(session, ["PURCHASING_MANAGER", "OPERATIONS_MANAGER"]);
  const canPay = hasRole(session, ["FINANCE_ADMIN", "PURCHASING_MANAGER"]);

  const items = supplier.purchaseBatches.flatMap((b) => b.items);
  const totalKg = items.reduce((s, i) => s + Number(i.weightKg), 0);

  // Unified statement: payments (credits) + deliveries (debits) by date
  type Entry = { date: Date; label: string; credit: number; debit: number };
  const statement: Entry[] = [
    ...payments.map((p) => ({
      date: p.paidAt,
      label: `Payment${p.batchId ? " (against a batch)" : " / advance"}${p.note ? ` — ${p.note}` : ""} · ${p.method}`,
      credit: Number(p.amount),
      debit: 0,
    })),
    ...supplier.purchaseBatches
      .filter((b) => b.scaledInAt)
      .map((b) => ({
        date: b.scaledInAt!,
        label: `Delivery ${b.lotNo}`,
        credit: 0,
        debit: b.items.reduce((s, i) => s + Number(i.amount), 0),
      })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div>
      <PageHeader title={supplier.name} subtitle={supplier.type?.name ?? "Unspecified type"} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Batches delivered" value={supplier.purchaseBatches.filter((b) => b.scaledInAt).length} />
        <StatCard label="Total supplied" value={formatKg(totalKg)} />
        <StatCard label="Delivered value" value={formatNaira(account.totalDelivered)} hint={`Paid ${formatNaira(account.totalPaid)}`} />
        <StatCard
          label={account.balance >= 0 ? "Prepaid credit" : "Owed to supplier"}
          value={formatNaira(Math.abs(account.balance))}
          hint={account.balance > 0.01 ? "Covers future deliveries" : account.balance < -0.01 ? "Payable" : "Settled"}
          tone={account.balance < -0.01 ? "warning" : "accent"}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 text-sm font-medium">Contact & details</h2>
          <dl className="grid grid-cols-[110px_1fr] gap-x-2 gap-y-1 text-sm">
            <dt className="text-muted">Phone</dt><dd>{supplier.phone ?? "—"}</dd>
            <dt className="text-muted">Contact</dt><dd>{supplier.contactPerson ?? "—"}{supplier.contactPhone ? ` · ${supplier.contactPhone}` : ""}</dd>
            <dt className="text-muted">Address</dt><dd>{supplier.address ?? "—"}</dd>
            <dt className="text-muted">Bank</dt><dd>{supplier.bankName ?? "—"} {supplier.bankAccountNo ?? ""}</dd>
            <dt className="text-muted">Notes</dt><dd>{supplier.notes ?? "—"}</dd>
          </dl>
        </Card>
        <Card>
          <h2 className="mb-1 text-sm font-medium">Pay supplier / record advance</h2>
          <p className="mb-3 text-xs text-muted">
            One account. Advances (no batch) and batch payments both credit it; deliveries settle oldest-first.
          </p>
          {canPay ? (
            <SupplierPaymentForm supplierId={supplier.id} submitLabel="Record payment" />
          ) : (
            <p className="text-sm text-muted">Only finance/purchasing can record payments.</p>
          )}
        </Card>
      </div>

      {canManage && (
        <Card className="mt-4">
          <h2 className="mb-3 font-medium">Edit supplier</h2>
          <SupplierForm
            types={types.map((t) => ({ id: t.id, name: t.name }))}
            onedit
            supplier={{
              id: supplier.id,
              name: supplier.name,
              typeId: supplier.typeId,
              phone: supplier.phone,
              contactPerson: supplier.contactPerson,
              contactPhone: supplier.contactPhone,
              address: supplier.address,
              bankName: supplier.bankName,
              bankAccountNo: supplier.bankAccountNo,
              notes: supplier.notes,
            }}
          />
        </Card>
      )}

      <h2 className="mb-2 mt-6 font-medium">Account statement</h2>
      {statement.length === 0 ? (
        <Card><p className="py-4 text-center text-sm text-muted">No account activity yet.</p></Card>
      ) : (
        <Table headers={["Date", "Detail", "Paid (credit)", "Delivered (debit)"]}>
          {statement.map((e, i) => (
            <tr key={i}>
              <td className="px-3 py-2">{e.date.toLocaleDateString("en-NG")}</td>
              <td className="px-3 py-2">{e.label}</td>
              <td className="tabular px-3 py-2 text-accent">{e.credit > 0 ? formatNaira(e.credit) : "—"}</td>
              <td className="tabular px-3 py-2 text-muted">{e.debit > 0 ? formatNaira(e.debit) : "—"}</td>
            </tr>
          ))}
        </Table>
      )}

      <h2 className="mb-2 mt-6 font-medium">Supply history</h2>
      {supplier.purchaseBatches.length === 0 ? (
        <Card><p className="py-4 text-center text-sm text-muted">No batches from this supplier yet.</p></Card>
      ) : (
        <Table headers={["Lot", "Date", "Weight", "Value", "Covered", "Settlement"]}>
          {supplier.purchaseBatches.map((b) => {
            const s = account.batches[b.id];
            return (
              <tr key={b.id}>
                <td className="px-3 py-2">
                  <Link href={`/purchases/${b.id}`} className="tabular font-medium hover:underline">{b.lotNo}</Link>
                </td>
                <td className="px-3 py-2">{b.createdAt.toLocaleDateString("en-NG")}</td>
                <td className="tabular px-3 py-2">{formatKg(b.items.reduce((sum, i) => sum + Number(i.weightKg), 0))}</td>
                <td className="tabular px-3 py-2">{formatNaira(s?.cost ?? 0)}</td>
                <td className="tabular px-3 py-2">{formatNaira(s?.covered ?? 0)}</td>
                <td className="px-3 py-2"><Badge tone={statusTone(s?.status ?? "UNPAID")}>{s?.status ?? "UNPAID"}</Badge></td>
              </tr>
            );
          })}
        </Table>
      )}
    </div>
  );
}
