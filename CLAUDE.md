# CLAUDE.md

Zyntomax: operations platform for a Nigerian recycling company. Design doc: SYSTEM_DESIGN.md. Setup & verification: README.md.

## Commands

```bash
docker compose up -d                     # Postgres :5433, Redis :6380
pnpm db:push && pnpm db:seed             # schema + seed (login 08000000001 / zyntomax123)
pnpm --filter @zyntomax/web dev          # admin on http://localhost:3100
pnpm --filter @zyntomax/field dev        # staff/admin Expo app
pnpm --filter @zyntomax/vendor dev       # vendor Expo app (OTP login)
pnpm --filter @zyntomax/web exec tsc --noEmit   # typecheck
node apps/web/scripts/mobile-api-test.mjs        # mobile API smoke test (server must be running)
```

After a schema change, stop the web dev server before `prisma generate` (it locks the query-engine DLL on Windows), then restart it (Next caches the Prisma client in memory).

E2E business-loop test: see README "Verification" (needs ADMIN_ID env var, hits /api/dev/e2e).

## Architecture rules

- **Ledgers are append-only.** Never store or hand-edit a balance; inventory = `InventoryMovement` sums, money = `WalletTransaction` sums. Corrections are reversing entries. `lib/inventory.ts` computes balances.
- **One material catalog, three kinds** (`MaterialType.kind`: RAW / INTERMEDIATE / FINISHED). Production transforms materials via **recipes** (`StageOutput`: stage + input material → output material; a stage can branch one input into several outputs). A job consumes its input and produces the recipe's outputs, mass-balanced (Σoutputs + waste + discrepancy = weightIn). **Only FINISHED materials are sellable.** Inventory has three buckets keyed by location kind: INTAKE = raw, IN_PROCESSING/STAGE_WIP = in processing (intermediates, incl. mid-line outputs), FINISHED_STORE = finished. See `PRODUCTION_MODEL.md` and `inventoryBuckets()` in `lib/inventory.ts`.
- **Every operational table carries `siteId`** (multi-site). Master data (materials, stages, recipes, roles, customers, suppliers) is global; rates/tolerances/settings are global-with-site-override.
- **Rates snapshot at transaction time** (`ratePerKg`, `unitPrice`, `toleranceSnapshot`) — history must never recalculate when a rate changes.
- Vendors are paid on **field weigh-in amounts**; staff wages on **good output kg × rate card** (see `lib/wages.ts`).
- Money movements need **idempotency keys**; the mobile sync dedupes on `clientUuid`.

## Conventions

- Admin pages: server components + server actions (`actions.ts` per route folder); forms are small client components using `useActionState`. Role checks via `requireRole` / `hasRole` (`lib/auth.ts`); every mutation writes `lib/audit.ts`.
- Mobile API (`app/api/mobile/*`): staff Bearer JWT (`lib/mobile-auth.ts`); vendor API (`app/api/vendor/*`) uses a separate vendor JWT (`lib/vendor-auth.ts`, `aud: "vendor"`). Same AUTH_SECRET as web cookie sessions. Both bypass the staff middleware (see `PUBLIC_PATHS`). Business logic shared with actions lives in `lib/` (e.g. `lib/collection.ts`, `lib/trips.ts`) — never duplicate it.
- Wages honour per-staff `wageModel` (commission/salary/commission+base) and per-stage `payBasis` (scale-in vs scale-out) via `lib/wages.ts`. Flagged-job discrepancies can be charged back to staff/supervisor pay (`DiscrepancyCharge`, settled on the next payroll).
- Uploads go through `lib/storage.ts` (`/api/upload`) — dev writes to `public/uploads`; swap for S3/R2 in prod.
- Paystack (`lib/paystack.ts`) simulates when the key contains `placeholder`; SMS (`lib/sms.ts`) logs to Notification when TERMII_API_KEY is empty.
- UI tokens in `globals.css` (@theme); shared primitives in `components/ui.tsx`. Money/weights display via `formatNaira`/`formatKg` with the `tabular` class.
- Prisma `Decimal` fields: always wrap in `Number()` before arithmetic or display.
