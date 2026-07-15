import { prisma } from "@zyntomax/db";
import { requireSession } from "@/lib/auth";
import { PageHeader, Table, Badge, StatCard, formatNaira } from "@/components/ui";

const KIND_TONE = {
  TOPUP: "success",
  PAYOUT: "warning",
  FEE: "neutral",
  REFUND: "info",
} as const;

export default async function WalletPage() {
  await requireSession();

  const transactions = await prisma.walletTransaction.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const balance = transactions.reduce((s, t) => s + Number(t.amount), 0);
  const monthIn = transactions
    .filter((t) => Number(t.amount) > 0 && t.createdAt.getMonth() === new Date().getMonth())
    .reduce((s, t) => s + Number(t.amount), 0);
  const monthOut = transactions
    .filter((t) => Number(t.amount) < 0 && t.createdAt.getMonth() === new Date().getMonth())
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

  return (
    <div>
      <PageHeader
        title="Wallet"
        subtitle="Internal ledger mirroring the Paystack balance — every entry is append-only"
      />

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Balance" value={formatNaira(balance)} tone={balance > 0 ? "accent" : "destructive"} />
        <StatCard label="In this month" value={formatNaira(monthIn)} />
        <StatCard label="Out this month" value={formatNaira(monthOut)} />
      </div>

      <div className="mt-4">
        <Table headers={["Date", "Type", "Note", "Reference", "Amount"]}>
          {transactions.map((t) => (
            <tr key={t.id}>
              <td className="px-3 py-2">{t.createdAt.toLocaleString("en-NG")}</td>
              <td className="px-3 py-2">
                <Badge tone={KIND_TONE[t.kind]}>{t.kind}</Badge>
              </td>
              <td className="px-3 py-2 text-muted">{t.note ?? "—"}</td>
              <td className="tabular px-3 py-2 text-xs">{t.paystackRef ?? "—"}</td>
              <td className={`tabular px-3 py-2 font-medium ${Number(t.amount) < 0 ? "text-destructive" : "text-accent"}`}>
                {Number(t.amount) < 0 ? "−" : "+"}{formatNaira(Math.abs(Number(t.amount)))}
              </td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  );
}
