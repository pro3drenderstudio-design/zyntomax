import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const defaults = ["Independent collector", "Dumpsite aggregator", "Reseller"];
const types = {};
for (const name of defaults) {
  types[name] = await prisma.supplierType.upsert({
    where: { name },
    update: {},
    create: { name },
  });
}

// Assign any untyped suppliers to a sensible default by name heuristic.
const untyped = await prisma.supplier.findMany({ where: { typeId: null } });
for (const s of untyped) {
  const lower = s.name.toLowerCase();
  const typeName = lower.includes("dumpsite")
    ? "Dumpsite aggregator"
    : lower.includes("reseller")
      ? "Reseller"
      : "Independent collector";
  await prisma.supplier.update({
    where: { id: s.id },
    data: { typeId: types[typeName].id },
  });
}
console.log(`Ensured ${defaults.length} supplier types; assigned ${untyped.length} suppliers.`);
await prisma.$disconnect();
