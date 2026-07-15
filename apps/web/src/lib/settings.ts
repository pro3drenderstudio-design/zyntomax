import { prisma } from "@zyntomax/db";

/** Read a setting; a site-specific row overrides the global default. */
export async function getSetting<T>(
  key: string,
  fallback: T,
  siteId?: string,
): Promise<T> {
  const rows = await prisma.setting.findMany({
    where: { key, OR: [{ siteId: null }, ...(siteId ? [{ siteId }] : [])] },
  });
  const siteRow = siteId ? rows.find((r) => r.siteId === siteId) : undefined;
  const globalRow = rows.find((r) => r.siteId === null);
  const row = siteRow ?? globalRow;
  return row ? (row.value as T) : fallback;
}

export async function setSetting(key: string, value: unknown, siteId?: string) {
  const existing = await prisma.setting.findFirst({
    where: { key, siteId: siteId ?? null },
  });
  if (existing) {
    await prisma.setting.update({
      where: { id: existing.id },
      data: { value: value as never },
    });
  } else {
    await prisma.setting.create({
      data: { key, value: value as never, siteId: siteId ?? null },
    });
  }
}
