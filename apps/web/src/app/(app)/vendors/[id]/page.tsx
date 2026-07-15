import { notFound } from "next/navigation";
import { prisma } from "@zyntomax/db";
import { requireSession } from "@/lib/auth";
import {
  PageHeader, Card, Badge, statusTone, Table, formatKg, formatNaira, StatCard,
} from "@/components/ui";

export default async function VendorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;

  const vendor = await prisma.vendor.findUnique({
    where: { id },
    include: {
      locality: true,
      weighIns: {
        include: { materialType: true, trip: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      payouts: { orderBy: { createdAt: "desc" }, take: 20 },
      rewardGrants: { include: { tier: true } },
    },
  });
  if (!vendor) notFound();

  const tiers = await prisma.rewardTier.findMany({
    where: { active: true },
    orderBy: { thresholdKg: "asc" },
  });

  const lifetimeKg = vendor.weighIns.reduce((s, w) => s + Number(w.weightKg), 0);
  const lifetimeNaira = vendor.weighIns.reduce((s, w) => s + Number(w.amount), 0);
  const nextTier = tiers.find(
    (t) =>
      Number(t.thresholdKg) > lifetimeKg &&
      !vendor.rewardGrants.some((g) => g.tierId === t.id),
  );

  return (
    <div>
      <PageHeader
        title={vendor.name}
        subtitle={`${vendor.phone} · ${vendor.locality?.name ?? "No locality"}`}
        action={<Badge tone={statusTone(vendor.status)}>{vendor.status}</Badge>}
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Lifetime collected" value={formatKg(lifetimeKg)} />
        <StatCard label="Lifetime earned" value={formatNaira(lifetimeNaira)} />
        <StatCard
          label="Bank"
          value={vendor.bankVerified ? "Verified" : "Unverified"}
          hint={vendor.bankAccountName ?? vendor.bankName ?? "No account"}
          tone={vendor.bankVerified ? "accent" : "warning"}
        />
        <StatCard
          label="Next reward"
          value={nextTier ? nextTier.name : "All earned"}
          hint={
            nextTier
              ? `${formatKg(Number(nextTier.thresholdKg) - lifetimeKg)} to go — ${nextTier.reward}`
              : undefined
          }
        />
      </div>

      {vendor.lat && vendor.lng && (
        <Card className="mt-4">
          <p className="text-sm">
            <span className="font-medium">Pinned location: </span>
            <span className="tabular">{vendor.lat.toFixed(5)}, {vendor.lng.toFixed(5)}</span>
            {vendor.address && <span className="text-muted"> · {vendor.address}</span>}
          </p>
        </Card>
      )}

      <h2 className="mb-2 mt-6 font-medium">Weigh-in history</h2>
      {vendor.weighIns.length === 0 ? (
        <Card><p className="py-4 text-center text-sm text-muted">No collections from this vendor yet.</p></Card>
      ) : (
        <Table headers={["Date", "Material", "Weight", "Rate", "Amount", "Confirmed"]}>
          {vendor.weighIns.map((w) => (
            <tr key={w.id}>
              <td className="px-3 py-2">{w.createdAt.toLocaleDateString("en-NG")}</td>
              <td className="px-3 py-2">{w.materialType.name}</td>
              <td className="tabular px-3 py-2">{formatKg(Number(w.weightKg))}</td>
              <td className="tabular px-3 py-2">{formatNaira(Number(w.ratePerKg))}/kg</td>
              <td className="tabular px-3 py-2 font-medium">{formatNaira(Number(w.amount))}</td>
              <td className="px-3 py-2">
                <Badge tone={w.confirmation === "NONE" ? "warning" : "success"}>
                  {w.confirmation === "NONE" ? "Unconfirmed" : w.confirmation.replace("_", " ")}
                </Badge>
              </td>
            </tr>
          ))}
        </Table>
      )}

      <h2 className="mb-2 mt-6 font-medium">Payments</h2>
      {vendor.payouts.length === 0 ? (
        <Card><p className="py-4 text-center text-sm text-muted">No payouts yet.</p></Card>
      ) : (
        <Table headers={["Date", "Amount", "Reference", "Status"]}>
          {vendor.payouts.map((p) => (
            <tr key={p.id}>
              <td className="px-3 py-2">{p.createdAt.toLocaleDateString("en-NG")}</td>
              <td className="tabular px-3 py-2 font-medium">{formatNaira(Number(p.amount))}</td>
              <td className="tabular px-3 py-2 text-xs">{p.paystackRef ?? "—"}</td>
              <td className="px-3 py-2"><Badge tone={statusTone(p.status)}>{p.status}</Badge></td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
