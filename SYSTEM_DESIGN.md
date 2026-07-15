# Zyntomax Platform — System Design

*The single system that runs Zyntomax Ventures Limited end to end: waste collection, purchasing, factory production, sales & dispatch, HR & wages, finance, and reporting. Designed multi-site from day one.*

---

## 1. The one-paragraph model

Everything in Zyntomax is one of two flows, and the system tracks both as append-only ledgers:

- **Material flows in one direction:** vendor's gate / supplier's truck → collection vehicle → factory intake → sorting → (stages…) → finished goods store → dispatch truck → customer. Every hop is a weigh event with who/when/where/photo, and the difference between hops is computed automatically. Weight can never appear or disappear without a record.
- **Money flows in both directions:** in from customer payments and wallet top-ups; out to vendors (Paystack), suppliers, staff wages, and expenses. Every naira is a ledger entry tied to the material or activity that caused it.

Because both ledgers are immutable (corrections are reversing entries, never edits), balances are always computed, discrepancies are always visible, and P&L falls out for free.

## 2. Apps

| App | Platform | Who |
|---|---|---|
| **Zyntomax Admin** | Web (Next.js, responsive) | CEO/super admin, ops, finance, HR, factory supervisor, purchasing manager, auditor |
| **Zyntomax Field** | Mobile (Expo, Android-first, offline-first) | Collection agents, team leads, purchasing manager, factory floor stations |
| **Zyntomax Vendor** | Mobile + SMS/WhatsApp fallback | Household vendors (phase 5 — agent-assisted flow covers vendors from day one) |

- The Field app is **one app with role-gated screens**, not separate apps per role.
- Factory scale stations run the Field app on **shared Android tablets**; workers authenticate by scanning the QR on their staff ID card.
- Household vendors are not yet registered and many won't have smartphones → every vendor interaction has an **agent-assisted + SMS path**. The vendor app is a later bonus, never the only channel.
- Independent collectors/suppliers mostly have Android → a lightweight supplier view can ride on the Field app later (see their purchase history and payments).

## 3. Roles

| Role | Key powers |
|---|---|
| Super Admin (CEO) | Everything: roles, sites, material types, stages, rate cards, thresholds, payout settings |
| Operations Manager | Collections, factory dashboard, staff assignment; no financial settings |
| Factory Supervisor | Scale in purchases, reconcile & approve collections, create/close production jobs, resolve discrepancies |
| Finance Admin | Wallet top-ups, payout batch approval, expenses, payroll runs, invoicing, budgets |
| Purchasing Manager | Suppliers, field purchases, purchase batches |
| HR Admin | Staff records, ID cards, PPE issuance, medical/rewards logs, advances |
| Sales Admin | Customers, price lists, sales orders, dispatch authorization |
| Team Lead (Collection) | Runs a trip: route, weigh-ins, manifest |
| Collection Agent | Register vendors, record weigh-ins, assisted pickup requests |
| Production Staff | Own assignments and own wage tally only |
| Auditor | Read-only everything, including audit log |
| Vendor | Request pickup, weigh history, payments, rewards, collection dates |

Users hold **multiple roles** (`user → roles[]`), each role grant optionally scoped to a site. At current scale (~40 staff) several roles land on the same few people; the model doesn't care.

## 4. Multi-site

- `sites` table (factory / collection hub). Every operational record carries `site_id`.
- **Global:** material types, process stage definitions, roles, products, customers, suppliers.
- **Per-site (with global defaults):** rate cards, tolerances, thresholds, settings, targets.
- Role grants are per-site or global; a site manager sees only their site, the CEO sees all with a site switcher + consolidated view.
- **Inter-site transfers** are just inventory movements between two sites' locations — the ledger design covers them with zero extra machinery.

## 5. End-to-end flows

### 5.1 Collection loop (household vendors)
1. **Register vendor** (Field app): name, phone, photo, address, **GPS pin**, locality, bank account (Paystack name-match verification at registration), BVN handled per §10. Admin map shows clustered pins + density heatmap per locality.
2. **Pickup request** — via vendor app, SMS/WhatsApp, or agent-logged call. Must exceed admin-set weight threshold. Requests pool by locality. Scheduled locality collection dates also exist; vendors get SMS the day before.
3. **Trip** — ops creates: team lead, members, vehicle, locality, date, assigned requests + route vendors.
4. **Field weigh-in** — per vendor per material type: weight, rate snapshot from rate card, **photo of scale face** (manual analogue scales make this essential), auto GPS, **vendor confirmation via SMS OTP or on-screen signature**. Fully offline-capable; client-generated UUIDs make sync idempotent.
5. **Live manifest** — admin sees the trip's running total in real time.
6. **Factory reconciliation** — supervisor scales the truck in per material type. Variance vs manifest is auto-computed against an admin-set **tolerance %** (moisture/spillage). Within tolerance → green; beyond → supervisor records a reason, lands on the exceptions report. Supervisor approves.
7. **Payout batch** — approval generates one Paystack transfer per vendor, **on the field weigh-in amount** (vendors never absorb post-gate losses; the reconciliation variance is an internal team-accountability control, not a payment adjustment). Wallet balance check → finance tops up if short → release. Idempotency keys, webhook confirmation, failure queue for retry/manual fix. Vendor gets SMS: "You've been paid ₦4,300 for 21.5kg PET."
8. **Rewards** — cumulative kg tracked per vendor against admin-defined tiers (e.g. 100kg → foodstuff pack); eligible vendors flagged; staff log fulfilment; progress visible to the vendor.

### 5.2 Purchase loop (suppliers / dumpsites / independent collectors)
1. Supplier registry: type, phone, bank, price & quality history over time.
2. Purchasing manager logs the field purchase (supplier, est. weight, agreed ₦/kg, any advance paid).
3. At the factory: supervisor **scales in the purchase batch** — timestamp, lot number, line items per material type (one truck, mixed types). Field estimate vs factory actual = auto discrepancy.
4. Finance attaches expenses to the batch (logistics, loading labour…) → system computes **landed cost per kg per batch**.
5. **Supplier payment** recorded against the batch (transfer/cash, less any advance) — payables visible until settled.

### 5.3 Production
1. **Material types** (PET, general plastics, tin, iron, aluminium…) are admin-created. Each has an ordered **process route** (e.g. PET: sorting → post-sorting → crushing → washing → pelletizing). Stages are admin-created; adding one later doesn't break history.
2. **Job** = stage + material type + assigned staff + scaled-in weight. 30 sorters = 30 concurrent jobs (or grouped assignments). Scale station tablet, staff QR login.
3. On completion: scale out **good output** + **waste**. `in − (out + waste)` = job discrepancy, checked against per-stage tolerance; out-of-tolerance blocks the output from moving on until the supervisor resolves it.
4. Output of the final stage becomes a **product** (finished SKU: material + form, e.g. "PET pellets") in the finished goods store.
5. **Lot traceability:** the lot number from the purchase batch / collection trip follows material through every stage to finished goods → yield per source ("dumpsite X's PET yields 71%, supplier Y's 84%") directly informs purchasing.
6. **Live WIP dashboard:** raw inventory by type, kg in each stage right now, finished goods by product — all computed from the movement ledger.

### 5.4 Sales & dispatch
1. **Customers** (offtakers) with contacts, credit terms, and history.
2. **Price list** per product with effective dates; optional per-customer overrides.
3. **Sales order:** customer + line items (product, qty kg, unit price). Confirming reserves finished goods (visible as "reserved" vs "available").
4. **Dispatch:** vehicle, driver, waybill number, **scale-out weights per line + gate photo**. Partial dispatches supported; dispatched weight is the invoiced weight.
5. **Invoice** auto-generated from dispatch; **customer payments** recorded against it (transfer/Paystack); receivables aging report (current / 30 / 60 / 90).
6. Sales revenue feeds P&L; dispatch is just another inventory movement out of finished goods, so stock always reconciles.

### 5.5 HR & wages
- Full staff profile: bio-data, photo, bank, BVN (per §10), next of kin, emergency contact, address, documents, role(s), hire date.
- **ID card auto-generated** from a template (photo, name, role, staff no, **QR code**) — the QR is also the scale-station login.
- Logs: PPE/equipment issuance (item, date, condition, signature), medical treatments, rewards/disciplinary, **salary advances**.
- **Rate card:** ₦/kg per (stage × material type), with effective dates so historical payroll never recalculates.
- Every completed job earns `good output kg × rate` — **pay on accepted output, not input** (paying on input rewards rushing and inflating waste).
- **Weekly payroll run:** open week → auto-tally per staff → deduct advances (per-week deduction cap so no one takes home ₦0) → pay via Paystack batch or log manual payment → close week (locks underlying jobs).
- Staff see their own live wage tally in the Field app — transparency pre-empts disputes.

### 5.6 Finance, budgets, projections
- Expenses with categories, receipt photos, and optional links to purchase batches / trips / staff.
- **Wallet:** Paystack balance mirrored in an internal ledger; every top-up, payout, and fee is an entry.
- Budgets per category per month; actual-vs-budget report.
- **Targets:** admin sets e.g. *40 tons finished output/month* (total or per material, per site). Dashboard: achieved, **kg remaining**, required daily run-rate vs actual, projected month-end. Same pattern for collection, purchasing, and sales targets.
- **P&L:** revenue (invoices) − COGS (batch landed cost + stage wages, allocated via lots) − opex = gross/net profit, per period / material / site.
- **Unit economics:** true cost per kg of finished goods vs selling price, per product — the report that says which materials make money.

## 6. Data model (phase-1-complete entity map)

`site_id` on every operational table; `created_by` + timestamps everywhere; ledgers append-only.

### Core
| Table | Key fields |
|---|---|
| `organizations` | one row now; future-proofs white-label/multi-company |
| `sites` | name, type (factory/hub), address, active |
| `users` | phone, email, auth, status |
| `roles` / `user_roles` | role, user, site_id (null = global) |
| `staff_profiles` | user, staff_no, photo, bank (encrypted), bvn_ref, next_of_kin, emergency_contact, address, hire_date, documents[] |
| `settings` | key, value, site_id (null = global default) |
| `audit_logs` | actor, action, entity, entity_id, before/after JSON, ts |
| `notifications` | user/vendor, channel (push/sms/inapp), payload, status |

### Vendors & collection
| Table | Key fields |
|---|---|
| `localities` | site, name, center/polygon |
| `vendors` | site, locality, name, phone, photo, lat/lng, address, bank_account + verified_name, bvn_ref, status, registered_by |
| `reward_tiers` / `reward_grants` | threshold_kg, reward; vendor, tier, fulfilled_by, date |
| `pickup_requests` | vendor, est_weight, source (app/sms/agent), status |
| `trips` | site, team_lead, members[], vehicle, locality, date, status |
| `collection_weighins` | trip, vendor, material_type, weight_kg, rate_snapshot, amount, photo, gps, confirmation (otp/signature), agent, client_uuid, ts |
| `trip_reconciliations` | trip, per-material remitted kg, variance, tolerance_snapshot, reason, approved_by, ts |
| `payout_batches` / `payouts` | trip, total, status; vendor, amount, paystack_ref, idempotency_key, status, failure_reason |

### Purchasing
| Table | Key fields |
|---|---|
| `suppliers` | name, type (independent/dumpsite/reseller), phone, bank, notes |
| `purchase_batches` | site, supplier, purchasing_manager, lot_no, field_est_kg, scaled_in_at, payment_status |
| `purchase_batch_items` | batch, material_type, weight_kg, price_per_kg, amount |
| `supplier_payments` | batch, amount, method, ref, advance_flag, date |

### Materials, inventory & production
| Table | Key fields |
|---|---|
| `material_types` | name, active |
| `process_stages` | name, active |
| `material_routes` | material_type, stage, sequence |
| `products` | material_type, form (pellets/flakes/bale…), name, unit |
| `inventory_locations` | site, kind (intake / stage_wip / finished_store / vehicle), stage_id? |
| `inventory_movements` | **append-only ledger:** from_location, to_location, material_type or product, weight_kg, lot_no, ref_type+ref_id (job/trip/batch/dispatch/transfer), by, ts |
| `jobs` | site, stage, material_type, lot_no, assignees[], weight_in, weight_out, waste_kg, discrepancy, tolerance_snapshot, photos, status, started/completed |

### HR & wages
| Table | Key fields |
|---|---|
| `rate_cards` | site?, stage, material_type, rate_per_kg, effective_from |
| `payroll_runs` / `payroll_items` | site, week, status, totals; run, staff, earned, advance_deduction, net, payment_ref |
| `salary_advances` | staff, amount, date, outstanding, weekly_deduction_cap |
| `issuances` | staff, item, qty, condition, date, signature |
| `medical_logs`, `staff_incidents` | staff, description, cost?, date, type (reward/disciplinary/medical) |

### Sales
| Table | Key fields |
|---|---|
| `customers` | name, contacts, credit_terms, notes |
| `price_lists` | product, price_per_kg, effective_from, customer_id? (override) |
| `sales_orders` / `sales_order_items` | customer, site, status; product, qty_kg, unit_price |
| `dispatches` / `dispatch_items` | order, vehicle, driver, waybill_no, gate_photo, status; product, weight_kg |
| `invoices` / `customer_payments` | dispatch, amount, due_date, status; invoice, amount, method, ref, date |

### Finance & planning
| Table | Key fields |
|---|---|
| `expense_categories` / `expenses` | site, category, amount, receipt_photo, links (purchase_batch? trip? staff?), date |
| `wallet_transactions` | direction, amount, kind (topup/payout/fee/refund), paystack_ref, ts |
| `budgets` | site?, category, period, amount |
| `targets` | metric (output/collection/purchase/sales), material?, site?, period, value |

## 7. Tech stack

- **Monorepo:** Turborepo — `apps/web` (admin), `apps/field` + `apps/vendor` (Expo, shared packages), `packages/db` (Prisma), `packages/api`, `packages/shared`.
- **Web:** Next.js + Tailwind + shadcn/ui; MapLibre/Leaflet with clustering for the vendor map (Mapbox if a polished heatmap is wanted).
- **Mobile:** React Native + Expo; offline queue via SQLite/WatermelonDB; client UUIDs for idempotent sync.
- **API:** Next.js route handlers (tRPC or REST) to start; split out a service only if event volume demands it.
- **DB:** PostgreSQL + Prisma. Ledger tables append-only.
- **Queues:** BullMQ + Redis — payouts, SMS, webhooks never run inline in a request.
- **Payments:** Paystack Transfers + dedicated virtual account for top-ups; webhook signature verification; idempotency keys on every transfer.
- **SMS/WhatsApp:** Termii (or similar Nigerian provider).
- **Files:** S3-compatible (Cloudflare R2) for photos, ID cards, receipts, documents.
- **ID cards:** server-rendered from template (React → PNG/PDF) with QR.

## 8. Build order

| Phase | Scope | Why this order |
|---|---|---|
| **1 — Collection money loop** | Auth/roles/sites, staff records, vendor registration + map, trips, field weigh-in (offline), reconciliation, Paystack payouts, SMS | The highest-fraud-risk, highest-trust flow; justifies the app alone |
| **2 — Factory** | Suppliers, purchase batches + expenses + landed cost, material types, routes/stages, jobs, scale in/out/waste, WIP dashboard, lots | Turns the factory from opaque to glass |
| **3 — Wages** | Rate cards, weekly payroll runs, advances, PPE/medical/incident logs, ID cards | Depends on phase-2 job data; kills payday disputes |
| **4 — Sales** | Customers, price lists, orders, dispatch, invoicing, receivables | Closes the revenue side; enables true P&L |
| **5 — Intelligence + vendor self-service** | Budgets, targets/projections, unit economics, P&L, rewards engine, Vendor app | Built on complete data from phases 1–4 |

Phases 3 and 4 can swap depending on which manual process hurts more. Each phase is independently useful in production.

## 9. Integrity controls (summary)

- Append-only ledgers; corrections are reversing entries.
- Photo + GPS + timestamp on every field/gate weigh event (manual analogue scales → photos are the evidence).
- Vendor OTP/signature confirmation at weigh-in.
- Tolerance thresholds at every hop; out-of-tolerance requires a reason and surfaces on an exceptions report.
- Idempotency keys on all money movements; webhook-confirmed; failure queues.
- Full audit log on every write.
- Payroll close locks underlying jobs.

## 10. Compliance & data protection

- BVN and bank details are NDPR-regulated. Prefer **Paystack account resolution** (verify name↔account) over storing raw BVN; if BVN must be retained, encrypt at the application level, restrict access to finance/HR roles, display last-4 only, and log every access.
- Photos of vendors/staff are personal data — access-controlled storage, signed URLs, no public buckets.

## 11. Current scale assumptions

Hundreds of vendors (pre-registration), ~30 sorters + 5 operators + supervisor + purchasing manager + HR + CEO, manual analogue/digital scales, multiple sites planned, independent collectors mostly on Android. Single Postgres comfortably handles 100× this volume; the architecture scales by adding sites, not by re-platforming.
