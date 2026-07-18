import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@zyntomax/db";
import { requireSession, hasRole } from "@/lib/auth";
import {
  PageHeader, Card, Table, Badge, statusTone, StatCard, formatKg, formatNaira,
} from "@/components/ui";
import { SupplierForm } from "../supplier-form";
import { PrepayForm } from "./prepay-form";

export default async function SupplierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const [supplier, types] = await Promise.all([
    prisma.supplier.findUnique({
      where: { id },
      include: {
        type: true,
        prepayments: { orderBy: { createdAt: "desc" } },
        purchaseBatches: {
          include: { items: true, supplierPayments: true },
          orderBy: { createdAt: "desc" },
        },
      },
    }),
    prisma.supplierType.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!supplier) notFound();

  const canManage = hasRole(session, ["PURCHASING_MANAGER", "OPERATIONS_MANAGER"]);
  const canPay = hasRole(session, ["FINANCE_ADMIN", "PURCHASING_MANAGER"]);

  const items = supplier.purchaseBatches.flatMap((b) => b.items);
  const totalKg = items.reduce((s, i) => s + Number(i.weightKg), 0);
  const totalValue = items.reduce((s, i) => s + Number(i.amount), 0);
  const prepaid = supplier.prepayments.reduce((s, p) => s + Number(p.amount), 0);
  const directPaid = supplier.purchaseBatches
    .flatMap((b) => b.supplierPayments)
    .reduce((s, p) => s + Number(p.amount), 0);
  // Prepayment balance = advances − (value of delivered batches settled against advances).
  // Simplified: outstanding supplier credit = prepaid − (totalValue − directPaid).
  const consumed = Math.max(0, totalValue - directPaid);
  const prepaidBalance = prepaid - consumed;

  return (
    <div>
      <PageHeader
        title={supplier.name}
        subtitle={supplier.type?.name ?? "Unspecified type"}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Batches delivered" value={supplier.purchaseBatches.length} />
        <StatCard label="Total supplied" value={formatKg(totalKg)} />
        <StatCard label="Total value" value={formatNaira(totalValue)} />
        <StatCard
          label="Prepaid balance"
          value={formatNaira(prepaidBalance)}
          hint={prepaidBalance > 0 ? "Credit with supplier" : prepaidBalance < 0 ? "Owed to supplier" : undefined}
          tone={prepaidBalance < 0 ? "warning" : "accent"}
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
          <h2 className="mb-2 text-sm font-medium">Upfront payments (advances)</h2>
          {canPay && <div className="mb-3"><PrepayForm supplierId={supplier.id} /></div>}
          {supplier.prepayments.length === 0 ? (
            <p className="py-3 text-center text-sm text-muted">No advances recorded.</p>
          ) : (
            <ul className="flex flex-col gap-1 text-sm">
              {supplier.prepayments.map((p) => (
                <li key={p.id} className="flex items-center justify-between">
                  <span className="text-muted">{p.createdAt.toLocaleDateString("en-NG")} · {p.method}{p.note ? ` · ${p.note}` : ""}</span>
                  <span className="tabular font-medium">{formatNaira(Number(p.amount))}</span>
                </li>
              ))}
            </ul>
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

      <h2 className="mb-2 mt-6 font-medium">Supply history</h2>
      {supplier.purchaseBatches.length === 0 ? (
        <Card><p className="py-4 text-center text-sm text-muted">No batches from this supplier yet.</p></Card>
      ) : (
        <Table headers={["Lot", "Date", "Weight", "Value", "Payment"]}>
          {supplier.purchaseBatches.map((b) => (
            <tr key={b.id}>
              <td className="px-3 py-2">
                <Link href={`/purchases/${b.id}`} className="tabular font-medium hover:underline">{b.lotNo}</Link>
              </td>
              <td className="px-3 py-2">{b.createdAt.toLocaleDateString("en-NG")}</td>
              <td className="tabular px-3 py-2">{formatKg(b.items.reduce((s, i) => s + Number(i.weightKg), 0))}</td>
              <td className="tabular px-3 py-2">{formatNaira(b.items.reduce((s, i) => s + Number(i.amount), 0))}</td>
              <td className="px-3 py-2"><Badge tone={statusTone(b.paymentStatus)}>{b.paymentStatus}</Badge></td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
