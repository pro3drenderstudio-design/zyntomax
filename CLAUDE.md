# CLAUDE.md

Zyntomax: operations platform for a Nigerian recycling company. Design doc: SYSTEM_DESIGN.md. Setup & verification: README.md.

## Commands

```bash
docker compose up -d                     # Postgres :5433, Redis :6380
pnpm db:push && pnpm db:seed             # schema + seed (login 08000000001 / zyntomax123)
pnpm --filter @zyntomax/web dev          # admin on http://localhost:3100
pnpm --filter @zyntomax/web exec tsc --noEmit   # typecheck
node apps/web/scripts/mobile-api-test.mjs        # mobile API smoke test (server must be running)
```

E2E business-loop test: see README "Verification" (needs ADMIN_ID env var, hits /api/dev/e2e).

## Architecture rules

- **Ledgers are append-only.** Never store or hand-edit a balance; inventory = `InventoryMovement` sums, money = `WalletTransaction` sums. Corrections are reversing entries. `lib/inventory.ts` computes balances.
- **Every operational table carries `siteId`** (multi-site). Master data (materials, stages, products, roles, customers, suppliers) is global; rates/tolerances/settings are global-with-site-override.
- **Rates snapshot at transaction time** (`ratePerKg`, `unitPrice`, `toleranceSnapshot`) — history must never recalculate when a rate changes.
- Vendors are paid on **field weigh-in amounts**; staff wages on **good output kg × rate card** (see `lib/wages.ts`).
- Money movements need **idempotency keys**; the mobile sync dedupes on `clientUuid`.

## Conventions

- Admin pages: server components + server actions (`actions.ts` per route folder); forms are small client components using `useActionState`. Role checks via `requireRole` / `hasRole` (`lib/auth.ts`); every mutation writes `lib/audit.ts`.
- Mobile API (`app/api/mobile/*`): Bearer JWT (`lib/mobile-auth.ts`), same AUTH_SECRET as web cookie sessions. Business logic shared with actions lives in `lib/` (e.g. `lib/collection.ts`) — never duplicate it.
- Paystack (`lib/paystack.ts`) simulates when the key contains `placeholder`; SMS (`lib/sms.ts`) logs to Notification when TERMII_API_KEY is empty.
- UI tokens in `globals.css` (@theme); shared primitives in `components/ui.tsx`. Money/weights display via `formatNaira`/`formatKg` with the `tabular` class.
- Prisma `Decimal` fields: always wrap in `Number()` before arithmetic or display.
