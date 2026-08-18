import { PrismaClient } from "@prisma/client";

/**
 * On the Supabase transaction pooler (port 6543) pgBouncer multiplexes client
 * connections onto a small real Postgres pool, so a per-instance
 * `connection_limit=1` needlessly serialises the many parallel queries our
 * dashboard / reports / budgets pages fire — producing intermittent P2024
 * "connection pool timeout" errors and sluggish navigation under load.
 *
 * Raise the limit (and ensure `pgbouncer=true`) ONLY when we detect that
 * transaction pooler, where it is safe. Direct or session-mode connections are
 * left exactly as configured so we never risk exhausting Postgres itself.
 */
function tunedDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;

  const onTransactionPooler = /:6543(\/|\?|$)/.test(url);
  if (!onTransactionPooler) return url;

  const TARGET = 10;
  let tuned = url;

  const current = tuned.match(/[?&]connection_limit=(\d+)/);
  if (current) {
    if (Number(current[1]) < TARGET) {
      tuned = tuned.replace(/([?&]connection_limit=)\d+/, `$1${TARGET}`);
    }
  } else {
    tuned += (tuned.includes("?") ? "&" : "?") + `connection_limit=${TARGET}`;
  }

  // pgBouncer transaction mode can't use prepared statements; Prisma needs this.
  if (!/[?&]pgbouncer=true/.test(tuned)) {
    tuned += "&pgbouncer=true";
  }

  return tuned;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function makeClient(): PrismaClient {
  const url = tunedDatabaseUrl();
  return new PrismaClient({
    ...(url ? { datasources: { db: { url } } } : {}),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export * from "@prisma/client";
export { Prisma } from "@prisma/client";
