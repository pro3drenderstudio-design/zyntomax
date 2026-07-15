# Zyntomax Platform

All-in-one operations platform for Zyntomax Ventures Limited: household waste collection, raw material purchasing, factory production, sales & dispatch, HR & piece-rate wages, and finance — multi-site from day one.

Full design rationale: [SYSTEM_DESIGN.md](./SYSTEM_DESIGN.md).

## Repository layout

```
apps/web        Next.js 15 admin (port 3100) + mobile REST API + Paystack webhook
apps/field      Expo (React Native) field app — vendor registration, weigh-ins, offline outbox
packages/db     Prisma schema + client + seed (source of truth for the data model)
design-system/  Generated design tokens (ui-ux-pro-max)
```

## Getting started

```bash
# 1. Infrastructure (Postgres on :5433, Redis on :6380)
docker compose up -d

# 2. Install
pnpm install

# 3. Environment — copy and fill (AUTH_SECRET, Paystack test keys)
cp .env.example packages/db/.env
cp .env.example apps/web/.env

# 4. Database
pnpm db:push
pnpm db:seed

# 5. Run the admin
pnpm --filter @zyntomax/web dev    # http://localhost:3100
```

**Seed logins** (password `zyntomax123`):

| Phone | Role |
|---|---|
| 08000000001 | Super Admin |
| 08000000002 | Factory Supervisor |
| 08000000003 | Finance Admin |
| 08000000004 | Purchasing Manager |
| 08000000005 | Team Lead |

Staff registered through the app sign in with their phone number as the initial password.

## Field app (Expo)

```bash
# Set the API URL to your machine's LAN IP in apps/field/app.json → expo.extra.apiUrl
pnpm --filter @zyntomax/field dev   # scan the QR with Expo Go (Android)
```

Registration and weigh-ins work offline: records land in an outbox (AsyncStorage) with client-generated UUIDs and sync when connectivity returns — the server dedupes on UUID so retries are always safe.

## Core invariants (do not break)

1. **Balances are computed, never stored.** Inventory comes from `InventoryMovement` (append-only), money from `WalletTransaction`. Corrections are reversing entries.
2. **Weight moves between locations** (`VENDOR_GATE → VEHICLE → INTAKE → stage WIP → FINISHED_STORE → CUSTOMER`, waste to `WASTE`). Every hop records who/when, and discrepancies are computed at each hop against admin-set tolerances.
3. **Vendors are paid on the field weigh-in amount** — reconciliation variance is an internal control, not a payment adjustment.
4. **Wages are paid on good output** (`weightOut × rate`), never on input.
5. **Money movements carry idempotency keys**; Paystack webhooks confirm final state.
6. **Rates snapshot at transaction time** (`ratePerKg` on weigh-ins, `unitPrice` on order items) so history never recalculates.

## Verification

With the dev server running and the DB seeded:

```bash
# Full business loop through the real server actions
# (collection → payout, purchase → production → finished goods, payroll, sale → invoice)
$adminId = (docker exec zyntomax-postgres psql -U zyntomax -d zyntomax -t -A -c 'SELECT id FROM \"User\" WHERE phone=''08000000001'';').Trim()
$env:ADMIN_ID = $adminId; node apps/web/scripts/e2e-run.mjs

# Mobile API (login, bootstrap, idempotent vendor + weigh-in)
node apps/web/scripts/mobile-api-test.mjs
```

Both must report all checks passing. The e2e route (`/api/dev/e2e`) is disabled in production.

## Paystack

Dev runs in **simulation mode** while `PAYSTACK_SECRET_KEY` contains `placeholder` — transfers succeed instantly without hitting Paystack. Put real test keys in `apps/web/.env` to exercise the live API, and point a webhook at `/api/webhooks/paystack` (signature-verified).

## Deliberately deferred

- Vendor self-service app (agent-assisted flow + SMS covers vendors; see SYSTEM_DESIGN.md §2)
- Factory scale stations currently use the responsive admin on shared tablets; a dedicated station mode in the field app can come later
- Photo capture upload (schema fields exist; S3/R2 wiring pending)
- BullMQ workers for payout/SMS queues (currently inline; Redis is provisioned)
