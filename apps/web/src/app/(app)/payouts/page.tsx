import Link from "next/link";
import { prisma } from "@zyntomax/db";
import { requireSession, hasRole } from "@/lib/auth";
import {
  PageHeader, Card, Badge, statusTone, Table, StatCard, formatNaira, buttonClass,
} from "@/components/ui";
import { releaseBatch } from "./actions";
import { TopUpForm } from "./topup-form";

export default async function PayoutsPage() {
  const session = await requireSession();
  const isFinance = hasRole(session, ["FINANCE_ADMIN"]);

  const [batches, walletAgg] = await Promise.all([
    prisma.payoutBatch.findMany({
      include: {
        trip: { include: { locality: true } },
        payouts: { include: { vendor: true }, orderBy: { amount: "desc" } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.walletTransaction.aggregate({ _sum: { amount: true } }),
  ]);

  const balance = Number(walletAgg._sum.amount ?? 0);
  const outstanding = batches
    .filter((b) => !["COMPLETED"].includes(b.status))
    .reduce(
      (s, b) =>
        s +
        b.payouts
          .filter((p) => ["PENDING", "FAILED"].includes(p.status))
          .reduce((x, p) => x + Number(p.amount), 0),
      0,
    );

  return (
    <div>
      <PageHeader
        title="Vendor payouts"
        subtitle="Approved collections generate payout batches — release sends Paystack transfers"
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard
          label="Wallet balance"
          value={formatNaira(balance)}
          tone={balance < outstanding ? "destructive" : "accent"}
        />
        <StatCard label="Outstanding payouts" value={formatNaira(outstanding)} />
        <Card className="col-span-2 md:col-span-1">
          {isFinance ? (
            <TopUpForm />
          ) : (
            <p className="text-sm text-muted">
              Only finance can top up the wallet and release payouts.
            </p>
          )}
        </Card>
      </div>

      {balance < outstanding && outstanding > 0 && (
        <Card className="mt-3 border-warning bg-warning-soft">
          <p className="text-sm text-warning">
            Wallet balance does not cover outstanding payouts. Top up{" "}
            <span className="tabular font-semibold">{formatNaira(outstanding - balance)}</span>{" "}
            before releasing.
          </p>
        </Card>
      )}

      <div className="mt-5 flex flex-col gap-4">
        {batches.length === 0 && (
          <Card>
            <p className="py-6 text-center text-sm text-muted">
              No payout batches yet. Approve a reconciled trip to create one.
            </p>
          </Card>
        )}
        {batches.map((b) => {
          const releasable =
            isFinance &&
            ["READY", "AWAITING_FUNDS", "PARTIAL_FAILED"].includes(b.status);
          return (
            <Card key={b.id}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">
                    <Link href={`/trips/${b.tripId}`} className="hover:underline">
                      {b.trip.locality?.name ?? "Trip"} —{" "}
                      {b.trip.date.toLocaleDateString("en-NG")}
                    </Link>
                  </p>
                  <p className="text-sm text-muted">
                    {b.payouts.length} vendors ·{" "}
                    <span className="tabular font-medium text-foreground">
                      {formatNaira(Number(b.totalAmount))}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={statusTone(b.status)}>{b.status.replace(/_/g, " ")}</Badge>
                  {releasable && (
                    <form action={releaseBatch.bind(null, b.id)}>
                      <button type="submit" className={buttonClass}>
                        {b.status === "PARTIAL_FAILED" ? "Retry failed" : "Release payouts"}
                      </button>
                    </form>
                  )}
                </div>
              </div>
              <Table headers={["Vendor", "Amount", "Reference", "Status", "Note"]}>
                {b.payouts.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2">
                      <Link href={`/vendors/${p.vendorId}`} className="hover:underline">
                        {p.vendor.name}
                      </Link>
                    </td>
                    <td className="tabular px-3 py-2 font-medium">{formatNaira(Number(p.amount))}</td>
                    <td className="tabular px-3 py-2 text-xs">{p.paystackRef ?? "—"}</td>
                    <td className="px-3 py-2">
                      <Badge tone={statusTone(p.status)}>{p.status}</Badge>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">{p.failureReason ?? ""}</td>
                  </tr>
                ))}
              </Table>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
