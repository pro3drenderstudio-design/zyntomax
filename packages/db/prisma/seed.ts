import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Zyntomax…");

  // ── Site ────────────────────────────────────────────────────────────
  const site = await prisma.site.upsert({
    where: { id: "site-main" },
    update: {},
    create: { id: "site-main", name: "Zyntomax Main Factory", kind: "FACTORY" },
  });

  // ── Users ───────────────────────────────────────────────────────────
  const password = await bcrypt.hash("zyntomax123", 10);

  const admin = await prisma.user.upsert({
    where: { phone: "08000000001" },
    update: {},
    create: {
      phone: "08000000001",
      email: "admin@zyntomax.com",
      name: "Super Admin",
      passwordHash: password,
      roles: { create: [{ role: "SUPER_ADMIN" }] },
      staffProfile: { create: { staffNo: "ZYN-0001", hireDate: new Date() } },
    },
  });

  const mkStaff = async (
    phone: string,
    name: string,
    role:
      | "OPERATIONS_MANAGER"
      | "FACTORY_SUPERVISOR"
      | "FINANCE_ADMIN"
      | "PURCHASING_MANAGER"
      | "HR_ADMIN"
      | "TEAM_LEAD"
      | "COLLECTION_AGENT"
      | "PRODUCTION_STAFF",
    staffNo: string,
  ) =>
    prisma.user.upsert({
      where: { phone },
      update: {},
      create: {
        phone,
        name,
        passwordHash: password,
        roles: { create: [{ role, siteId: site.id }] },
        staffProfile: { create: { staffNo, hireDate: new Date() } },
      },
      include: { staffProfile: true },
    });

  const supervisor = await mkStaff("08000000002", "Ibrahim Musa", "FACTORY_SUPERVISOR", "ZYN-0002");
  const finance = await mkStaff("08000000003", "Chiamaka Obi", "FINANCE_ADMIN", "ZYN-0003");
  const purchasing = await mkStaff("08000000004", "Tunde Bakare", "PURCHASING_MANAGER", "ZYN-0004");
  const teamLead = await mkStaff("08000000005", "Aisha Bello", "TEAM_LEAD", "ZYN-0005");
  await mkStaff("08000000006", "Emeka Nwosu", "COLLECTION_AGENT", "ZYN-0006");
  const sorters = [];
  for (let i = 0; i < 6; i++) {
    sorters.push(
      await mkStaff(
        `0800000001${i}`,
        ["Fatima Sule", "John Adeyemi", "Blessing Okoro", "Yusuf Garba", "Ngozi Eze", "Samuel Ojo"][i],
        "PRODUCTION_STAFF",
        `ZYN-001${i}`,
      ),
    );
  }

  // ── Materials (RAW / INTERMEDIATE / FINISHED), stages, recipes ─────
  type Kind = "RAW" | "INTERMEDIATE" | "FINISHED";
  const materialDefs: { name: string; kind: Kind; color?: string }[] = [
    // Raw
    { name: "PET", kind: "RAW", color: "#0ea5e9" },
    { name: "General Plastics", kind: "RAW", color: "#64748b" },
    { name: "Tin Can", kind: "RAW", color: "#a3a3a3" },
    { name: "Iron", kind: "RAW", color: "#78716c" },
    { name: "Aluminium", kind: "RAW", color: "#94a3b8" },
    // Intermediate (produced by sorting/crushing/washing)
    { name: "Sorted PET", kind: "INTERMEDIATE", color: "#22c55e" },
    { name: "Crushed PET", kind: "INTERMEDIATE", color: "#16a34a" },
    { name: "Washed PET", kind: "INTERMEDIATE", color: "#15803d" },
    { name: "PP White", kind: "INTERMEDIATE", color: "#e2e8f0" },
    { name: "PP Blue", kind: "INTERMEDIATE", color: "#3b82f6" },
    { name: "HDPE", kind: "INTERMEDIATE", color: "#f59e0b" },
    { name: "Masterbatch", kind: "INTERMEDIATE", color: "#a855f7" },
    { name: "Sorted Tin", kind: "INTERMEDIATE", color: "#d4d4d4" },
    // Finished (sellable)
    { name: "PET Pellets", kind: "FINISHED", color: "#065f46" },
    { name: "Crushed HDPE", kind: "FINISHED", color: "#b45309" },
    { name: "Crushed PP Blue", kind: "FINISHED", color: "#1d4ed8" },
    { name: "Crushed PP White", kind: "FINISHED", color: "#cbd5e1" },
    { name: "Tin Bales", kind: "FINISHED", color: "#737373" },
  ];
  const materials: Record<string, { id: string }> = {};
  for (const m of materialDefs) {
    materials[m.name] = await prisma.materialType.upsert({
      where: { name: m.name },
      update: { kind: m.kind, color: m.color },
      create: { name: m.name, kind: m.kind, color: m.color },
    });
  }

  const stageNames = ["Sorting", "Crushing", "Washing", "Pelletizing", "Baling"];
  const stages: Record<string, { id: string }> = {};
  for (const name of stageNames) {
    stages[name] = await prisma.processStage.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  // Sorters paid on what they're handed (scale-in); others on output
  await prisma.processStage.update({ where: { id: stages["Sorting"].id }, data: { payBasis: "SCALE_IN" } });

  // Recipes: (stage, input material) → output material
  const recipes: { stage: string; input: string; output: string }[] = [
    // PET line (linear)
    { stage: "Sorting", input: "PET", output: "Sorted PET" },
    { stage: "Crushing", input: "Sorted PET", output: "Crushed PET" },
    { stage: "Washing", input: "Crushed PET", output: "Washed PET" },
    { stage: "Pelletizing", input: "Washed PET", output: "PET Pellets" },
    // General Plastics (branching): sorting yields several sub-streams
    { stage: "Sorting", input: "General Plastics", output: "PP White" },
    { stage: "Sorting", input: "General Plastics", output: "PP Blue" },
    { stage: "Sorting", input: "General Plastics", output: "HDPE" },
    { stage: "Sorting", input: "General Plastics", output: "Masterbatch" },
    { stage: "Crushing", input: "HDPE", output: "Crushed HDPE" },
    { stage: "Crushing", input: "PP Blue", output: "Crushed PP Blue" },
    { stage: "Crushing", input: "PP White", output: "Crushed PP White" },
    // Metals
    { stage: "Sorting", input: "Tin Can", output: "Sorted Tin" },
    { stage: "Baling", input: "Sorted Tin", output: "Tin Bales" },
  ];
  for (const r of recipes) {
    await prisma.stageOutput.upsert({
      where: {
        stageId_inputMaterialTypeId_outputMaterialTypeId: {
          stageId: stages[r.stage].id,
          inputMaterialTypeId: materials[r.input].id,
          outputMaterialTypeId: materials[r.output].id,
        },
      },
      update: {},
      create: {
        stageId: stages[r.stage].id,
        inputMaterialTypeId: materials[r.input].id,
        outputMaterialTypeId: materials[r.output].id,
      },
    });
  }

  // ── Inventory locations ─────────────────────────────────────────────
  const locDefs = [
    { kind: "INTAKE" as const, name: "Factory Intake" },
    { kind: "IN_PROCESSING" as const, name: "In-Processing Store" },
    { kind: "FINISHED_STORE" as const, name: "Finished Goods Store" },
    { kind: "VEHICLE" as const, name: "Collection Vehicle" },
    { kind: "VENDOR_GATE" as const, name: "Vendor Gate" },
    { kind: "WASTE" as const, name: "Waste" },
    { kind: "CUSTOMER" as const, name: "Customer" },
  ];
  for (const d of locDefs) {
    const exists = await prisma.inventoryLocation.findFirst({
      where: { siteId: site.id, kind: d.kind, stageId: null, name: d.name },
    });
    if (!exists) {
      await prisma.inventoryLocation.create({ data: { siteId: site.id, kind: d.kind, name: d.name } });
    }
  }
  for (const s of stageNames) {
    const exists = await prisma.inventoryLocation.findFirst({
      where: { siteId: site.id, kind: "STAGE_WIP", stageId: stages[s].id },
    });
    if (!exists) {
      await prisma.inventoryLocation.create({
        data: { siteId: site.id, kind: "STAGE_WIP", stageId: stages[s].id, name: `${s} (active)` },
      });
    }
  }

  // ── Rates ───────────────────────────────────────────────────────────
  // Vendor (collection) prices — RAW materials only
  const vendorRates: Record<string, number> = {
    PET: 200, "General Plastics": 150, "Tin Can": 120, Iron: 180, Aluminium: 800,
  };
  for (const [mat, price] of Object.entries(vendorRates)) {
    const existing = await prisma.vendorRate.findFirst({ where: { materialTypeId: materials[mat].id } });
    if (!existing) await prisma.vendorRate.create({ data: { materialTypeId: materials[mat].id, pricePerKg: price } });
  }

  // Piece rates: ₦/kg per (stage × input material) — one per recipe input
  const stageRate: Record<string, number> = {
    Sorting: 10, Crushing: 12, Washing: 8, Pelletizing: 15, Baling: 10,
  };
  const rateInputs = new Set(recipes.map((r) => `${r.stage}::${r.input}`));
  for (const key of rateInputs) {
    const [stage, input] = key.split("::");
    const existing = await prisma.rateCard.findFirst({
      where: { stageId: stages[stage].id, materialTypeId: materials[input].id, siteId: null },
    });
    if (!existing) {
      await prisma.rateCard.create({
        data: { stageId: stages[stage].id, materialTypeId: materials[input].id, ratePerKg: stageRate[stage] },
      });
    }
  }

  // ── Settings, reward tiers, expense categories, target ─────────────
  const settings: Record<string, unknown> = {
    "collection.min_pickup_kg": 20,
    "collection.tolerance_pct": 3,
    "production.tolerance_pct": 2,
    "payout.sla_hours": 24,
    "payroll.advance_cap_pct": 50,
  };
  for (const [key, value] of Object.entries(settings)) {
    const existing = await prisma.setting.findFirst({ where: { key, siteId: null } });
    if (!existing) {
      await prisma.setting.create({ data: { key, value: value as never } });
    }
  }

  for (const tier of [
    { name: "Bronze", thresholdKg: 100, reward: "Foodstuff pack (rice + oil)" },
    { name: "Silver", thresholdKg: 250, reward: "Premium foodstuff hamper" },
    { name: "Gold", thresholdKg: 500, reward: "Cash bonus + hamper" },
  ]) {
    const existing = await prisma.rewardTier.findFirst({ where: { name: tier.name } });
    if (!existing) await prisma.rewardTier.create({ data: tier });
  }

  for (const name of [
    "Logistics",
    "Fuel & Diesel",
    "Equipment Maintenance",
    "Loading Labour",
    "Utilities",
    "Rent",
    "Medical",
    "PPE & Consumables",
    "Miscellaneous",
  ]) {
    await prisma.expenseCategory.upsert({ where: { name }, update: {}, create: { name } });
  }

  const now = new Date();
  const existingTarget = await prisma.target.findFirst({
    where: {
      metric: "FINISHED_OUTPUT_KG",
      periodYear: now.getFullYear(),
      periodMonth: now.getMonth() + 1,
      siteId: null,
      materialTypeId: null,
    },
  });
  if (!existingTarget) {
    await prisma.target.create({
      data: {
        metric: "FINISHED_OUTPUT_KG",
        periodYear: now.getFullYear(),
        periodMonth: now.getMonth() + 1,
        value: 40000, // 40 tons
      },
    });
  }

  // ── Localities & vendors (demo) ─────────────────────────────────────
  const localityDefs = [
    { name: "Agege", lat: 6.6155, lng: 3.3211 },
    { name: "Ikorodu", lat: 6.6194, lng: 3.5105 },
    { name: "Surulere", lat: 6.4926, lng: 3.3565 },
  ];
  const localities: Record<string, { id: string }> = {};
  for (const l of localityDefs) {
    localities[l.name] = await prisma.locality.upsert({
      where: { siteId_name: { siteId: site.id, name: l.name } },
      update: {},
      create: { siteId: site.id, name: l.name, centerLat: l.lat, centerLng: l.lng },
    });
  }

  const vendorNames = [
    "Mama Risi", "Alhaji Suleiman", "Iya Basira", "Mr Godwin", "Hajia Amina",
    "Baba Kehinde", "Mrs Adaeze", "Oga Festus", "Madam Bola", "Mallam Sani",
    "Sister Grace", "Chief Okonkwo",
  ];
  let vi = 0;
  for (const v of vendorNames) {
    const loc = localityDefs[vi % 3];
    const phone = `0810${String(1000000 + vi)}`; // 11-digit Nigerian format
    const existing = await prisma.vendor.findUnique({ where: { phone } });
    if (!existing) {
      await prisma.vendor.create({
        data: {
          siteId: site.id,
          localityId: localities[loc.name].id,
          vendorNo: `ZYN-V-${String(vi + 1).padStart(4, "0")}`,
          name: v,
          phone,
          lat: loc.lat + (Math.random() - 0.5) * 0.03,
          lng: loc.lng + (Math.random() - 0.5) * 0.03,
          bankName: "GTBank",
          bankAccountName: v,
          bankVerified: true,
          registeredById: admin.id,
        },
      });
    }
    vi++;
  }

  // ── Supplier types (dynamic) & suppliers ────────────────────────────
  const supplierTypeNames = ["Independent collector", "Dumpsite aggregator", "Reseller"];
  const supplierTypes: Record<string, { id: string }> = {};
  for (const name of supplierTypeNames) {
    supplierTypes[name] = await prisma.supplierType.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  for (const s of [
    { name: "Olusosun Dumpsite Aggregators", type: "Dumpsite aggregator" },
    { name: "Kano Independent Collectors Union", type: "Independent collector" },
    { name: "GreenCycle Resellers Ltd", type: "Reseller" },
  ]) {
    const existing = await prisma.supplier.findFirst({ where: { name: s.name } });
    if (!existing) {
      await prisma.supplier.create({
        data: { name: s.name, typeId: supplierTypes[s.type].id },
      });
    }
  }

  for (const c of [
    { name: "Lagos Polymer Industries", creditTermsDays: 14 },
    { name: "Apex Plastics Manufacturing", creditTermsDays: 0 },
    { name: "SteelWorks Nigeria Ltd", creditTermsDays: 30 },
  ]) {
    const existing = await prisma.customer.findFirst({ where: { name: c.name } });
    if (!existing) await prisma.customer.create({ data: c });
  }

  // List prices for FINISHED materials
  const listPrices: Record<string, number> = {
    "PET Pellets": 950,
    "Crushed HDPE": 700,
    "Crushed PP Blue": 720,
    "Crushed PP White": 680,
    "Tin Bales": 350,
  };
  for (const [mat, price] of Object.entries(listPrices)) {
    const existing = await prisma.priceList.findFirst({
      where: { materialTypeId: materials[mat].id, customerId: null },
    });
    if (!existing) {
      await prisma.priceList.create({
        data: { materialTypeId: materials[mat].id, pricePerKg: price },
      });
    }
  }

  // Diesel logs (demo — last 5 days)
  if ((await prisma.dieselLog.count()) === 0) {
    for (let i = 5; i >= 1; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      await prisma.dieselLog.create({
        data: {
          siteId: site.id,
          date: d,
          litres: 40 + Math.round(Math.random() * 30),
          cost: (40 + Math.round(Math.random() * 30)) * 1200,
          note: "Generator + forklift",
        },
      });
    }
  }

  // Opening wallet balance (demo)
  const walletCount = await prisma.walletTransaction.count();
  if (walletCount === 0) {
    await prisma.walletTransaction.create({
      data: { kind: "TOPUP", amount: 500000, note: "Opening balance (demo)" },
    });
  }

  console.log("Seed complete.");
  console.log("Login: phone 08000000001 / password zyntomax123 (Super Admin)");
  console.log("Others (same password): 08000000002 supervisor, 08000000003 finance, 08000000004 purchasing, 08000000005 team lead");
  void supervisor; void finance; void purchasing; void teamLead; void sorters;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
