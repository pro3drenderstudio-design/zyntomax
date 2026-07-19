import { prisma, Prisma } from "@zyntomax/db";

/**
 * Balances are never stored — they are computed from the append-only
 * InventoryMovement ledger: sum(in) − sum(out) per location.
 */

export type LocationBalance = {
  locationId: string;
  name: string;
  kind: string;
  stageName: string | null;
  siteId: string;
  totalKg: number;
};

export async function locationBalances(
  siteIds: string[] | null,
): Promise<LocationBalance[]> {
  const siteFilter = siteIds
    ? Prisma.sql`AND l."siteId" IN (${Prisma.join(siteIds)})`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<
    { id: string; name: string; kind: string; stageName: string | null; siteId: string; balance: number }[]
  >(Prisma.sql`
    SELECT
      l.id,
      l.name,
      l.kind::text AS kind,
      s.name AS "stageName",
      l."siteId",
      COALESCE(inflow.total, 0) - COALESCE(outflow.total, 0) AS balance
    FROM "InventoryLocation" l
    LEFT JOIN "ProcessStage" s ON s.id = l."stageId"
    LEFT JOIN (
      SELECT "toLocationId" AS lid, SUM("weightKg") AS total
      FROM "InventoryMovement" GROUP BY "toLocationId"
    ) inflow ON inflow.lid = l.id
    LEFT JOIN (
      SELECT "fromLocationId" AS lid, SUM("weightKg") AS total
      FROM "InventoryMovement" GROUP BY "fromLocationId"
    ) outflow ON outflow.lid = l.id
    WHERE l.kind NOT IN ('CUSTOMER', 'VENDOR_GATE', 'WASTE')
    ${siteFilter}
    ORDER BY l.kind, l.name
  `);

  return rows.map((r) => ({
    locationId: r.id,
    name: r.name,
    kind: r.kind,
    stageName: r.stageName,
    siteId: r.siteId,
    totalKg: Number(r.balance),
  }));
}

export type SellableItem = {
  kind: "product" | "stageOutput";
  id: string;
  name: string;
  color: string | null;
  siteId: string;
  availableKg: number;
};

/**
 * Everything currently available to sell from finished-goods stores:
 * finished products and named stage outputs (sorted PP, HDPE, PET caps…),
 * each with its available quantity. Used by the inventory view and to cap sales.
 */
export async function sellableStock(siteIds: string[] | null): Promise<SellableItem[]> {
  const siteFilter = siteIds
    ? Prisma.sql`AND l."siteId" IN (${Prisma.join(siteIds)})`
    : Prisma.empty;

  const products = await prisma.$queryRaw<
    { id: string; name: string; siteId: string; bal: number }[]
  >(Prisma.sql`
    SELECT p.id, p.name, l."siteId",
      SUM(CASE WHEN mv."toLocationId" = l.id THEN mv."weightKg"
               WHEN mv."fromLocationId" = l.id THEN -mv."weightKg" ELSE 0 END) AS bal
    FROM "InventoryMovement" mv
    JOIN "Product" p ON p.id = mv."productId"
    JOIN "InventoryLocation" l ON l.kind = 'FINISHED_STORE' AND (l.id = mv."toLocationId" OR l.id = mv."fromLocationId")
    WHERE mv."productId" IS NOT NULL ${siteFilter}
    GROUP BY p.id, p.name, l."siteId"
    HAVING SUM(CASE WHEN mv."toLocationId" = l.id THEN mv."weightKg" WHEN mv."fromLocationId" = l.id THEN -mv."weightKg" ELSE 0 END) > 0.01
  `);

  const outputs = await prisma.$queryRaw<
    { id: string; name: string; color: string | null; siteId: string; bal: number }[]
  >(Prisma.sql`
    SELECT so.id, so.name, so.color, l."siteId",
      SUM(CASE WHEN mv."toLocationId" = l.id THEN mv."weightKg"
               WHEN mv."fromLocationId" = l.id THEN -mv."weightKg" ELSE 0 END) AS bal
    FROM "InventoryMovement" mv
    JOIN "StageOutput" so ON so.id = mv."stageOutputId"
    JOIN "InventoryLocation" l ON l.kind = 'FINISHED_STORE' AND (l.id = mv."toLocationId" OR l.id = mv."fromLocationId")
    WHERE mv."stageOutputId" IS NOT NULL ${siteFilter}
    GROUP BY so.id, so.name, so.color, l."siteId"
    HAVING SUM(CASE WHEN mv."toLocationId" = l.id THEN mv."weightKg" WHEN mv."fromLocationId" = l.id THEN -mv."weightKg" ELSE 0 END) > 0.01
  `);

  return [
    ...products.map((p) => ({ kind: "product" as const, id: p.id, name: p.name, color: null, siteId: p.siteId, availableKg: Number(p.bal) })),
    ...outputs.map((o) => ({ kind: "stageOutput" as const, id: o.id, name: o.name, color: o.color, siteId: o.siteId, availableKg: Number(o.bal) })),
  ];
}

/** Per material/product breakdown at one location. */
export async function locationBreakdown(locationId: string) {
  const rows = await prisma.$queryRaw<
    { label: string; balance: number }[]
  >(Prisma.sql`
    SELECT
      COALESCE(m.name, p.name, so.name, 'Unknown') AS label,
      SUM(
        CASE
          WHEN mv."toLocationId" = ${locationId} THEN mv."weightKg"
          ELSE -mv."weightKg"
        END
      ) AS balance
    FROM "InventoryMovement" mv
    LEFT JOIN "MaterialType" m ON m.id = mv."materialTypeId"
    LEFT JOIN "Product" p ON p.id = mv."productId"
    LEFT JOIN "StageOutput" so ON so.id = mv."stageOutputId"
    WHERE mv."toLocationId" = ${locationId} OR mv."fromLocationId" = ${locationId}
    GROUP BY COALESCE(m.name, p.name, so.name, 'Unknown')
    HAVING SUM(
      CASE
        WHEN mv."toLocationId" = ${locationId} THEN mv."weightKg"
        ELSE -mv."weightKg"
      END
    ) <> 0
    ORDER BY balance DESC
  `);
  return rows.map((r) => ({ label: r.label, kg: Number(r.balance) }));
}

/** Ensure the standard locations exist for a site (idempotent). */
export async function ensureSiteLocations(siteId: string) {
  const defaults = [
    { kind: "INTAKE" as const, name: "Factory Intake" },
    { kind: "FINISHED_STORE" as const, name: "Finished Goods Store" },
    { kind: "VEHICLE" as const, name: "Collection Vehicle" },
    { kind: "VENDOR_GATE" as const, name: "Vendor Gate" },
    { kind: "WASTE" as const, name: "Waste" },
    { kind: "CUSTOMER" as const, name: "Customer" },
  ];
  for (const d of defaults) {
    await prisma.inventoryLocation.upsert({
      where: {
        siteId_kind_stageId_name: {
          siteId,
          kind: d.kind,
          stageId: null as unknown as string,
          name: d.name,
        },
      },
      create: { siteId, kind: d.kind, name: d.name },
      update: {},
    }).catch(async () => {
      // Composite unique with null stageId can miss on upsert — fall back to find-or-create
      const existing = await prisma.inventoryLocation.findFirst({
        where: { siteId, kind: d.kind, stageId: null, name: d.name },
      });
      if (!existing) {
        await prisma.inventoryLocation.create({
          data: { siteId, kind: d.kind, name: d.name },
        });
      }
    });
  }
}

/** Find-or-create the WIP location for a stage at a site. */
export async function stageLocation(siteId: string, stageId: string) {
  const stage = await prisma.processStage.findUniqueOrThrow({
    where: { id: stageId },
  });
  const existing = await prisma.inventoryLocation.findFirst({
    where: { siteId, kind: "STAGE_WIP", stageId },
  });
  if (existing) return existing;
  return prisma.inventoryLocation.create({
    data: { siteId, kind: "STAGE_WIP", stageId, name: `${stage.name} WIP` },
  });
}

export async function siteLocation(
  siteId: string,
  kind: "INTAKE" | "FINISHED_STORE" | "VEHICLE" | "VENDOR_GATE" | "WASTE" | "CUSTOMER",
) {
  const existing = await prisma.inventoryLocation.findFirst({
    where: { siteId, kind, stageId: null },
  });
  if (existing) return existing;
  await ensureSiteLocations(siteId);
  const created = await prisma.inventoryLocation.findFirst({
    where: { siteId, kind, stageId: null },
  });
  if (!created) throw new Error(`Could not ensure ${kind} location for site`);
  return created;
}
