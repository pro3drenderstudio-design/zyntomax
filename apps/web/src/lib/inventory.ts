import { prisma, Prisma } from "@zyntomax/db";

/**
 * Balances are computed from the append-only InventoryMovement ledger.
 * Every material (raw, intermediate, finished) is keyed by materialTypeId and
 * lives in a location whose kind determines its bucket:
 *   INTAKE          → raw (pre-processing)
 *   IN_PROCESSING   → intermediate, waiting for the next stage
 *   STAGE_WIP       → intermediate/raw actively being worked at a stage
 *   FINISHED_STORE  → finished goods
 */

export type MaterialStock = {
  materialId: string;
  name: string;
  kind: "RAW" | "INTERMEDIATE" | "FINISHED";
  color: string | null;
  kg: number;
};

export type StageStock = { stageId: string; stageName: string; materials: MaterialStock[] };

export type InventoryBuckets = {
  raw: MaterialStock[];
  waiting: MaterialStock[]; // intermediate, in the pool
  active: StageStock[]; // being worked, per stage
  finished: MaterialStock[];
};

export async function inventoryBuckets(siteIds: string[] | null): Promise<InventoryBuckets> {
  const siteFilter = siteIds
    ? Prisma.sql`AND l."siteId" IN (${Prisma.join(siteIds)})`
    : Prisma.empty;

  const rows = await prisma.$queryRaw<
    {
      id: string; name: string; kind: string; color: string | null;
      lockind: string; stageid: string | null; stagename: string | null; bal: number;
    }[]
  >(Prisma.sql`
    SELECT m.id, m.name, m.kind::text AS kind, m.color,
      l.kind::text AS lockind, l."stageId" AS stageid, s.name AS stagename,
      SUM(CASE WHEN mv."toLocationId" = l.id THEN mv."weightKg"
               WHEN mv."fromLocationId" = l.id THEN -mv."weightKg" ELSE 0 END) AS bal
    FROM "InventoryMovement" mv
    JOIN "InventoryLocation" l ON l.id = mv."toLocationId" OR l.id = mv."fromLocationId"
    JOIN "MaterialType" m ON m.id = mv."materialTypeId"
    LEFT JOIN "ProcessStage" s ON s.id = l."stageId"
    WHERE l.kind IN ('INTAKE','IN_PROCESSING','STAGE_WIP','FINISHED_STORE') ${siteFilter}
    GROUP BY m.id, m.name, m.kind, m.color, l.kind, l."stageId", s.name
    HAVING SUM(CASE WHEN mv."toLocationId" = l.id THEN mv."weightKg" WHEN mv."fromLocationId" = l.id THEN -mv."weightKg" ELSE 0 END) > 0.01
    ORDER BY m.name
  `);

  const buckets: InventoryBuckets = { raw: [], waiting: [], active: [], finished: [] };
  const stageMap = new Map<string, StageStock>();
  for (const r of rows) {
    const item: MaterialStock = {
      materialId: r.id, name: r.name, kind: r.kind as MaterialStock["kind"],
      color: r.color, kg: Number(r.bal),
    };
    if (r.lockind === "INTAKE") buckets.raw.push(item);
    else if (r.lockind === "IN_PROCESSING") buckets.waiting.push(item);
    else if (r.lockind === "FINISHED_STORE") buckets.finished.push(item);
    else if (r.lockind === "STAGE_WIP" && r.stageid) {
      let st = stageMap.get(r.stageid);
      if (!st) {
        st = { stageId: r.stageid, stageName: r.stagename ?? "Stage", materials: [] };
        stageMap.set(r.stageid, st);
        buckets.active.push(st);
      }
      st.materials.push(item);
    }
  }
  return buckets;
}

export type SellableItem = {
  materialId: string;
  name: string;
  color: string | null;
  siteId: string;
  availableKg: number;
};

/** FINISHED materials available to sell, per site, with quantity. */
export async function sellableStock(siteIds: string[] | null): Promise<SellableItem[]> {
  const siteFilter = siteIds
    ? Prisma.sql`AND l."siteId" IN (${Prisma.join(siteIds)})`
    : Prisma.empty;
  const rows = await prisma.$queryRaw<
    { id: string; name: string; color: string | null; siteId: string; bal: number }[]
  >(Prisma.sql`
    SELECT m.id, m.name, m.color, l."siteId",
      SUM(CASE WHEN mv."toLocationId" = l.id THEN mv."weightKg" WHEN mv."fromLocationId" = l.id THEN -mv."weightKg" ELSE 0 END) AS bal
    FROM "InventoryMovement" mv
    JOIN "MaterialType" m ON m.id = mv."materialTypeId" AND m.kind = 'FINISHED'
    JOIN "InventoryLocation" l ON l.kind = 'FINISHED_STORE' AND (l.id = mv."toLocationId" OR l.id = mv."fromLocationId")
    WHERE TRUE ${siteFilter}
    GROUP BY m.id, m.name, m.color, l."siteId"
    HAVING SUM(CASE WHEN mv."toLocationId" = l.id THEN mv."weightKg" WHEN mv."fromLocationId" = l.id THEN -mv."weightKg" ELSE 0 END) > 0.01
  `);
  return rows.map((r) => ({ materialId: r.id, name: r.name, color: r.color, siteId: r.siteId, availableKg: Number(r.bal) }));
}

/** Balance of a material at a specific location. */
export async function materialBalanceAt(locationId: string, materialTypeId: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ balance: number }[]>(Prisma.sql`
    SELECT COALESCE(SUM(
      CASE WHEN "toLocationId" = ${locationId} THEN "weightKg" ELSE -"weightKg" END
    ), 0) AS balance
    FROM "InventoryMovement"
    WHERE ("toLocationId" = ${locationId} OR "fromLocationId" = ${locationId})
      AND "materialTypeId" = ${materialTypeId}
  `);
  return Number(rows[0]?.balance ?? 0);
}

/** Available stock of a material at its home location (INTAKE for raw, IN_PROCESSING for intermediates). */
export async function materialAvailable(siteId: string, materialTypeId: string): Promise<number> {
  const mat = await prisma.materialType.findUnique({ where: { id: materialTypeId } });
  if (!mat) return 0;
  const kind = mat.kind === "RAW" ? "INTAKE" : "IN_PROCESSING";
  const loc = await prisma.inventoryLocation.findFirst({ where: { siteId, kind, stageId: null } });
  if (!loc) return 0;
  return materialBalanceAt(loc.id, materialTypeId);
}

/** Full processing history for one material — produced/consumed, with job/stage/staff/time. */
export async function materialHistory(materialTypeId: string, siteIds: string[] | null) {
  const siteFilter = siteIds
    ? Prisma.sql`AND (fl."siteId" IN (${Prisma.join(siteIds)}) OR tl."siteId" IN (${Prisma.join(siteIds)}))`
    : Prisma.empty;
  const rows = await prisma.$queryRaw<
    { createdAt: Date; weightKg: number; note: string | null; fromName: string | null; toName: string | null; byName: string | null; refType: string }[]
  >(Prisma.sql`
    SELECT mv."createdAt", mv."weightKg", mv.note, mv."refType"::text AS "refType",
      fl.name AS "fromName", tl.name AS "toName", u.name AS "byName"
    FROM "InventoryMovement" mv
    LEFT JOIN "InventoryLocation" fl ON fl.id = mv."fromLocationId"
    LEFT JOIN "InventoryLocation" tl ON tl.id = mv."toLocationId"
    LEFT JOIN "User" u ON u.id = mv."byId"
    WHERE mv."materialTypeId" = ${materialTypeId} ${siteFilter}
    ORDER BY mv."createdAt" DESC
    LIMIT 100
  `);
  return rows.map((r) => ({
    createdAt: r.createdAt,
    weightKg: Number(r.weightKg),
    note: r.note,
    from: r.fromName,
    to: r.toName,
    by: r.byName,
    refType: r.refType,
  }));
}

// ── Location helpers ──────────────────────────────────────────────────

export async function ensureSiteLocations(siteId: string) {
  const defaults: { kind: "INTAKE" | "IN_PROCESSING" | "FINISHED_STORE" | "VEHICLE" | "VENDOR_GATE" | "WASTE" | "CUSTOMER"; name: string }[] = [
    { kind: "INTAKE", name: "Factory Intake" },
    { kind: "IN_PROCESSING", name: "In-Processing Store" },
    { kind: "FINISHED_STORE", name: "Finished Goods Store" },
    { kind: "VEHICLE", name: "Collection Vehicle" },
    { kind: "VENDOR_GATE", name: "Vendor Gate" },
    { kind: "WASTE", name: "Waste" },
    { kind: "CUSTOMER", name: "Customer" },
  ];
  for (const d of defaults) {
    const existing = await prisma.inventoryLocation.findFirst({
      where: { siteId, kind: d.kind, stageId: null, name: d.name },
    });
    if (!existing) {
      await prisma.inventoryLocation.create({ data: { siteId, kind: d.kind, name: d.name } });
    }
  }
}

export async function stageLocation(siteId: string, stageId: string) {
  const stage = await prisma.processStage.findUniqueOrThrow({ where: { id: stageId } });
  const existing = await prisma.inventoryLocation.findFirst({
    where: { siteId, kind: "STAGE_WIP", stageId },
  });
  if (existing) return existing;
  return prisma.inventoryLocation.create({
    data: { siteId, kind: "STAGE_WIP", stageId, name: `${stage.name} (active)` },
  });
}

export async function siteLocation(
  siteId: string,
  kind: "INTAKE" | "IN_PROCESSING" | "FINISHED_STORE" | "VEHICLE" | "VENDOR_GATE" | "WASTE" | "CUSTOMER",
) {
  const existing = await prisma.inventoryLocation.findFirst({ where: { siteId, kind, stageId: null } });
  if (existing) return existing;
  await ensureSiteLocations(siteId);
  const created = await prisma.inventoryLocation.findFirst({ where: { siteId, kind, stageId: null } });
  if (!created) throw new Error(`Could not ensure ${kind} location for site`);
  return created;
}
