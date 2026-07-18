import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const vendors = await prisma.vendor.findMany({
  where: { vendorNo: null },
  orderBy: { createdAt: "asc" },
});
const maxRow = await prisma.vendor.findFirst({
  where: { vendorNo: { not: null } },
  orderBy: { vendorNo: "desc" },
});
let n = maxRow?.vendorNo ? Number(maxRow.vendorNo.replace(/\D/g, "")) : 0;
for (const v of vendors) {
  n += 1;
  await prisma.vendor.update({
    where: { id: v.id },
    data: { vendorNo: `ZYN-V-${String(n).padStart(4, "0")}` },
  });
}
console.log(`Backfilled ${vendors.length} vendor IDs.`);
await prisma.$disconnect();
