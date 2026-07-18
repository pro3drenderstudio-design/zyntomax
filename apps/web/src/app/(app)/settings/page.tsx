import { prisma } from "@zyntomax/db";
import { requireRole, hasRole } from "@/lib/auth";
import { getSetting } from "@/lib/settings";
import { PageHeader, Card, Table, formatNaira, formatKg, Badge } from "@/components/ui";
import {
  GeneralSettingsForm, VendorRateForm, PieceRateForm, SiteForm, LocalityForm, RewardTierForm,
  SupplierTypeManager, ExpenseCategoryManager,
} from "./settings-forms";

export default async function SettingsPage() {
  const session = await requireRole(["OPERATIONS_MANAGER"]);
  const isSuperAdmin = hasRole(session, []);

  const [materials, stages, sites, localities, tiers, vendorRates, rateCards, supplierTypes, expenseCategories] =
    await Promise.all([
      prisma.materialType.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
      prisma.processStage.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
      prisma.site.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.locality.findMany({ include: { site: true }, orderBy: { name: "asc" } }),
      prisma.rewardTier.findMany({ where: { active: true }, orderBy: { thresholdKg: "asc" } }),
      prisma.vendorRate.findMany({
        include: { materialType: true },
        orderBy: { effectiveFrom: "desc" },
      }),
      prisma.rateCard.findMany({
        where: { siteId: null },
        include: { stage: true, materialType: true },
        orderBy: { effectiveFrom: "desc" },
      }),
      prisma.supplierType.findMany({ orderBy: { name: "asc" } }),
      prisma.expenseCategory.findMany({ orderBy: { name: "asc" } }),
    ]);

  const settings = {
    "collection.min_pickup_kg": await getSetting("collection.min_pickup_kg", 20),
    "collection.tolerance_pct": await getSetting("collection.tolerance_pct", 3),
    "production.tolerance_pct": await getSetting("production.tolerance_pct", 2),
    "payout.sla_hours": await getSetting("payout.sla_hours", 24),
    "payroll.advance_cap_pct": await getSetting("payroll.advance_cap_pct", 50),
  };

  // Current effective rates (latest per key)
  const currentVendorRates = new Map<string, { name: string; price: number }>();
  for (const r of vendorRates) {
    if (!currentVendorRates.has(r.materialTypeId)) {
      currentVendorRates.set(r.materialTypeId, {
        name: r.materialType.name,
        price: Number(r.pricePerKg),
      });
    }
  }
  const currentPieceRates = new Map<string, { stage: string; material: string; rate: number }>();
  for (const r of rateCards) {
    const key = `${r.stageId}:${r.materialTypeId}`;
    if (!currentPieceRates.has(key)) {
      currentPieceRates.set(key, {
        stage: r.stage.name,
        material: r.materialType.name,
        rate: Number(r.ratePerKg),
      });
    }
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Thresholds, rates, sites and rewards" />

      <Card className="mb-4">
        <h2 className="mb-3 font-medium">Operational thresholds</h2>
        <GeneralSettingsForm values={settings} />
      </Card>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-medium">Vendor prices (what Zyntomax pays per kg)</h2>
          <Table headers={["Material", "Current price"]}>
            {[...currentVendorRates.values()].map((r) => (
              <tr key={r.name}>
                <td className="px-3 py-2">{r.name}</td>
                <td className="tabular px-3 py-2 font-medium">{formatNaira(r.price)}/kg</td>
              </tr>
            ))}
          </Table>
          <div className="mt-3">
            <VendorRateForm materials={materials.map((m) => ({ id: m.id, name: m.name }))} />
          </div>
        </Card>

        <Card>
          <h2 className="mb-3 font-medium">Piece rates (staff wage per output kg)</h2>
          <div className="max-h-64 overflow-y-auto">
            <Table headers={["Stage", "Material", "Rate"]}>
              {[...currentPieceRates.values()].map((r) => (
                <tr key={`${r.stage}:${r.material}`}>
                  <td className="px-3 py-2">{r.stage}</td>
                  <td className="px-3 py-2">{r.material}</td>
                  <td className="tabular px-3 py-2 font-medium">{formatNaira(r.rate)}/kg</td>
                </tr>
              ))}
            </Table>
          </div>
          <div className="mt-3">
            <PieceRateForm
              stages={stages.map((s) => ({ id: s.id, name: s.name }))}
              materials={materials.map((m) => ({ id: m.id, name: m.name }))}
            />
          </div>
        </Card>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-medium">Sites</h2>
          <ul className="mb-3 flex flex-col gap-1.5">
            {sites.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <span>{s.name}</span>
                <Badge tone={s.active ? "success" : "neutral"}>
                  {s.kind === "FACTORY" ? "Factory" : "Collection hub"}
                </Badge>
              </li>
            ))}
          </ul>
          {isSuperAdmin && <SiteForm />}
        </Card>

        <Card>
          <h2 className="mb-3 font-medium">Localities</h2>
          <ul className="mb-3 flex max-h-40 flex-col gap-1.5 overflow-y-auto">
            {localities.map((l) => (
              <li key={l.id} className="flex items-center justify-between text-sm">
                <span>{l.name}</span>
                <span className="text-xs text-muted">{l.site.name}</span>
              </li>
            ))}
          </ul>
          <LocalityForm sites={sites.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name }))} />
        </Card>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-medium">Supplier types</h2>
          <SupplierTypeManager items={supplierTypes.map((t) => ({ id: t.id, name: t.name }))} />
        </Card>
        <Card>
          <h2 className="mb-3 font-medium">Expense categories</h2>
          <ExpenseCategoryManager items={expenseCategories.map((c) => ({ id: c.id, name: c.name }))} />
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 font-medium">Vendor reward tiers</h2>
        <Table headers={["Tier", "Threshold", "Reward"]}>
          {tiers.map((t) => (
            <tr key={t.id}>
              <td className="px-3 py-2 font-medium">{t.name}</td>
              <td className="tabular px-3 py-2">{formatKg(Number(t.thresholdKg))} lifetime</td>
              <td className="px-3 py-2">{t.reward}</td>
            </tr>
          ))}
        </Table>
        <div className="mt-3">
          <RewardTierForm />
        </div>
      </Card>
    </div>
  );
}
