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

  // ── Material types, stages, routes, products ───────────────────────
  const materialNames = ["PET", "General Plastics", "Tin Can", "Iron", "Aluminium"];
  const materials: Record<string, { id: string }> = {};
  for (const name of materialNames) {
    materials[name] = await prisma.materialType.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const stageNames = ["Sorting", "Post-Sorting", "Crushing", "Washing", "Pelletizing", "Baling"];
  const stages: Record<string, { id: string }> = {};
  for (const name of stageNames) {
    stages[name] = await prisma.processStage.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const routes: Record<string, string[]> = {
    PET: ["Sorting", "Crushing", "Washing", "Pelletizing"],
    "General Plastics": ["Sorting", "Crushing", "Pelletizing"],
    "Tin Can": ["Sorting", "Baling"],
    Iron: ["Sorting", "Baling"],
    Aluminium: ["Sorting", "Baling"],
  };
  for (const [mat, stageList] of Object.entries(routes)) {
    for (let i = 0; i < stageList.length; i++) {
      await prisma.materialRoute.upsert({
        where: {
          materialTypeId_stageId: {
            materialTypeId: materials[mat].id,
            stageId: stages[stageList[i]].id,
          },
        },
        update: { sequence: i + 1 },
        create: {
          materialTypeId: materials[mat].id,
          stageId: stages[stageList[i]].id,
          sequence: i + 1,
        },
      });
    }
  }

  // Stage outputs (dynamic, colour-tagged) + pay basis — demo
  await prisma.processStage.update({
    where: { id: stages["Sorting"].id },
    data: { payBasis: "SCALE_IN" }, // sorters paid on what they're handed
  });
  const stageOutputDefs = [
    { stage: "Sorting", material: "PET", name: "PET caps", color: "#3b82f6" },
    { stage: "Sorting", material: "PET", name: "Pre-baled PET", color: "#22c55e" },
    { stage: "Sorting", material: "General Plastics", name: "HDPE", color: "#f59e0b" },
    { stage: "Sorting", material: "General Plastics", name: "PP", color: "#ef4444" },
  ];
  for (const o of stageOutputDefs) {
    const exists = await prisma.stageOutput.findFirst({
      where: { stageId: stages[o.stage].id, materialTypeId: materials[o.material].id, name: o.name },
    });
    if (!exists) {
      await prisma.stageOutput.create({
        data: {
          stageId: stages[o.stage].id,
          materialTypeId: materials[o.material].id,
          name: o.name,
          color: o.color,
        },
      });
    }
  }

  const productDefs = [
    { name: "PET Pellets", material: "PET", form: "pellets" },
    { name: "Plastic Pellets", material: "General Plastics", form: "pellets" },
    { name: "Tin Bales", material: "Tin Can", form: "bale" },
    { name: "Iron Bales", material: "Iron", form: "bale" },
    { name: "Aluminium Bales", material: "Aluminium", form: "bale" },
  ];
  const products: Record<string, { id: string }> = {};
  for (const p of productDefs) {
    products[p.name] = await prisma.product.upsert({
      where: { name: p.name },
      update: {},
      create: { name: p.name, form: p.form, materialTypeId: materials[p.material].id },
    });
  }

  // ── Inventory locations ─────────────────────────────────────────────
  const locDefs = [
    { kind: "INTAKE" as const, name: "Factory Intake" },
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
      await prisma.inventoryLocation.create({
        data: { siteId: site.id, kind: d.kind, name: d.name },
      });
    }
  }
  for (const s of Object.values(stageNames)) {
    const exists = await prisma.inventoryLocation.findFirst({
      where: { siteId: site.id, kind: "STAGE_WIP", stageId: stages[s].id },
    });
    if (!exists) {
      await prisma.inventoryLocation.create({
        data: { siteId: site.id, kind: "STAGE_WIP", stageId: stages[s].id, name: `${s} WIP` },
      });
    }
  }

  // ── Rates ───────────────────────────────────────────────────────────
  const vendorRates: Record<string, number> = {
    PET: 200,
    "General Plastics": 150,
    "Tin Can": 120,
    Iron: 180,
    Aluminium: 800,
  };
  for (const [mat, price] of Object.entries(vendorRates)) {
    const existing = await prisma.vendorRate.findFirst({
      where: { materialTypeId: materials[mat].id },
    });
    if (!existing) {
      await prisma.vendorRate.create({
        data: { materialTypeId: materials[mat].id, pricePerKg: price },
      });
    }
  }

  // Piece rates: ₦/kg per stage per material
  const pieceRates: Record<string, number> = {
    Sorting: 10,
    "Post-Sorting": 8,
    Crushing: 12,
    Washing: 8,
    Pelletizing: 15,
    Baling: 10,
  };
  for (const [stage, rate] of Object.entries(pieceRates)) {
    for (const mat of materialNames) {
      const existing = await prisma.rateCard.findFirst({
        where: { stageId: stages[stage].id, materialTypeId: materials[mat].id, siteId: null },
      });
      if (!existing) {
        await prisma.rateCard.create({
          data: {
            stageId: stages[stage].id,
            materialTypeId: materials[mat].id,
            ratePerKg: rate,
          },
        });
      }
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
    const phone = `0810000${String(100 + vi)}`;
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

  // Product list prices
  const listPrices: Record<string, number> = {
    "PET Pellets": 950,
    "Plastic Pellets": 700,
    "Tin Bales": 350,
    "Iron Bales": 400,
    "Aluminium Bales": 1500,
  };
  for (const [prod, price] of Object.entries(listPrices)) {
    const existing = await prisma.priceList.findFirst({
      where: { productId: products[prod].id, customerId: null },
    });
    if (!existing) {
      await prisma.priceList.create({
        data: { productId: products[prod].id, pricePerKg: price },
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
