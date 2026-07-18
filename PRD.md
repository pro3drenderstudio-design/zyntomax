# Zyntomax Platform — Product Requirements Document (Design Brief)

> **Purpose of this document:** a complete product + design brief for a design pass on the Zyntomax platform. It describes what the product is, who uses it, every screen that exists today, the data each screen carries, the current design system, and the specific design opportunities. The goal is to elevate visual design, layout, hierarchy, and interaction quality — **without changing the underlying data model, flows, or feature set.**

---

## 1. Product in one paragraph

Zyntomax is the operations platform for **Zyntomax Ventures Limited**, a Nigerian plastics/metals recycling company. It runs the entire business end to end: buying recyclable waste from household vendors and independent suppliers, processing it through a factory (sorting → crushing → washing → pelletizing → baling), selling finished goods to industrial buyers, and managing the staff, wages, and finances around all of it. Its core value is **traceability and fraud prevention** — every kilogram of material and every naira of money is an immutable ledger entry, so discrepancies, theft, and leakage surface immediately. It is built to run one factory today and be replicated across many sites.

**Design north star:** this is a *trust instrument* first and a data tool second. The design should make correctness feel obvious — where numbers reconcile, that should feel calm and confident; where they don't (a weight discrepancy, an overdue invoice, a failed payout), that should be impossible to miss. It is used by non-technical staff in a demanding physical environment, so clarity beats cleverness everywhere.

---

## 2. Users, context & constraints

### 2.1 Who uses it
A ~40-person operation. One person often wears several hats, so **navigation and permissions are role-driven** — each user sees only what their role allows.

| Role | Primary jobs | Sophistication |
|---|---|---|
| Super Admin / CEO | Oversight of everything, configuration | Medium |
| Operations Manager | Day-to-day: collections, factory, staffing | Medium |
| Factory Supervisor | Weigh material in/out, reconcile, approve, catch theft | Low–medium, on the floor |
| Finance Admin | Payouts, expenses, payroll, invoices, budgets | Medium–high |
| Purchasing Manager | Source raw material from suppliers | Low–medium, mobile |
| HR Admin | Staff records, ID cards, PPE, wages | Medium |
| Sales Admin | Customers, orders, dispatch, invoices | Medium |
| Team Lead / Collection Agent | Register vendors, weigh recyclables in the field | Low, on a phone, outdoors |
| Production Staff | See own assignments & wage tally | Low |
| Auditor | Read-only everything | High |
| Vendor (future) | Request pickup, see payments & rewards | Low, many without smartphones |

### 2.2 Physical & cultural context (critical design inputs)
- **Bright outdoor sunlight** (field agents) and **dusty factory floors** (supervisors on tablets). → **Light-first, very high contrast.** Dark mode exists but light is the primary experience.
- **Gloved hands, quick glances, one-handed phone use.** → Large touch targets (≥48px), big primary numbers, minimal typing on mobile (chips/steppers over free text where possible).
- **Unreliable connectivity** in field and factory. → Mobile is offline-first; "pending sync" is a first-class concept that must feel trustworthy, not alarming.
- **Money is Naira (₦)**, weights are **kilograms (kg)**. Numbers are the content — they must be scannable, aligned, and unambiguous. Amounts can be large (₦12,000,000).
- **Low-to-mixed digital literacy** for floor and field staff. Iconography must be backed by labels; status must never rely on color alone.
- **Fraud is the enemy.** Every screen where material or money changes hands should make the "expected vs actual" delta and its approval state legible at a glance.

### 2.3 Platforms
1. **Zyntomax Admin** — responsive web app (desktop-primary, used on office monitors and factory tablets). *The main surface; ~30 screens.*
2. **Zyntomax Field** — Android mobile app (Expo/React Native) for agents and scale stations. *6 screens, offline-first.*
3. **Zyntomax Vendor** — future mobile app (out of scope for this design pass).

---

## 3. Current design system (what exists to build on)

The app is already implemented with a coherent token set. Treat this as the **starting point to elevate**, not a blank canvas — but everything here is open to improvement.

### 3.1 Color tokens (light mode)
| Token | Value | Use |
|---|---|---|
| `--color-primary` | `#334155` (slate 700) | Primary structural / headings accent |
| `--color-accent` | `#059669` (emerald 600) | Brand action color, CTAs, positive |
| `--color-background` | `#f8fafc` | App background |
| `--color-surface` | `#ffffff` | Cards, tables, forms |
| `--color-foreground` | `#0f172a` | Primary text |
| `--color-muted` | `#64748b` | Secondary text |
| `--color-border` | `#e2e8f0` | Dividers, card borders |
| `--color-destructive` | `#dc2626` | Errors, failures, over-tolerance |
| `--color-warning` | `#d97706` | Pending, needs attention |
| `--color-info` | `#0284c7` | In-progress, informational |

Each semantic color has a `-soft` background variant (e.g. `accent-soft #d1fae5`) used for badges. Dark mode is fully tokenized.

**Brand feeling:** industrial slate + recycling green. Trustworthy, operational, a little utilitarian. There's room to make it warmer and more distinctly "Zyntomax" while keeping the industrial credibility.

### 3.2 Typography
- **Fira Sans** — all UI text.
- **Fira Code** (monospace) — applied via a `.tabular` class to **all numbers** (money, weights, counts, references) for column alignment and a "precision instrument" feel. This is intentional and should be preserved/strengthened.
- Base 16px, line-height 1.5.

### 3.3 Component inventory (already built)
- **PageHeader** — title + subtitle + optional right-aligned action button.
- **Card** — white surface, 1px border, subtle shadow, 0.5rem radius.
- **StatCard** — uppercase muted label, large tabular value, optional hint line, tone variants (default/accent/warning/destructive). Used in KPI rows everywhere.
- **Badge** — pill, semantic soft-bg + text tone. Driven by a `statusTone()` map covering ~35 statuses (ACTIVE, COMPLETED, PENDING, FLAGGED, OVERDUE, etc.).
- **Table** — bordered, muted uppercase header row, divided rows, horizontal-scroll wrapper. The workhorse component.
- **EmptyState** — centered title + hint + optional action.
- **Progress bar** — used for output-goal and budget-vs-actual.
- **Forms** — label + input (`inputClass`), inline validation errors in destructive color, primary/secondary buttons.
- **Sidebar** — grouped, role-filtered nav with lucide icons; collapses to a hamburger on mobile.

### 3.4 Known design weaknesses / opportunities
This is where a design pass adds the most value:
1. **Visual hierarchy is flat** — most screens are "header + KPI row + table(s)." Important vs routine information often looks the same weight.
2. **Density vs breathing room** — it's a dense operational tool, but some screens (staff profile, trip detail, reports) stack many sections with weak separation.
3. **Status & exception surfacing** — the "needs attention" states (flagged jobs, over-tolerance variances, failed payouts, overdue invoices) are the product's reason to exist and deserve stronger, more consistent visual treatment than a badge in a table cell.
4. **Empty & first-run states** are functional but plain — a real opportunity given the client is onboarding from zero.
5. **Data viz is minimal** — reports are mostly tables. The vendor density map is the only rich visual. There's room for tasteful charts (output trend, P&L, waste, WIP distribution).
6. **Forms are long and utilitarian** (staff registration, trip creation) — could use grouping, progressive disclosure, and better mobile ergonomics.
7. **Mobile field app** is clean but basic — the weigh-in flow especially could be more confidence-inspiring (it's the highest-fraud-risk, highest-frequency action).
8. **Brand personality is thin** — logo is a recycling glyph in an emerald square; there's no real identity system yet.

---

## 4. Information architecture (Admin web)

Sidebar, grouped, role-filtered:

```
Dashboard

COLLECTION
  Vendors
  Vendor Map
  Trips
  Payouts

FACTORY
  Purchases
  Suppliers
  Production
  Inventory
  Materials & Stages

SALES
  Customers
  Sales Orders
  Dispatches
  Invoices

PEOPLE
  Staff
  Payroll
  PPE & Logs

FINANCE
  Expenses
  Wallet
  Budgets
  Reports

Settings
```

Top bar (desktop): current user name + sign out. Mobile: hamburger + logo.

---

## 5. Screen-by-screen spec (Admin web)

For each screen: **purpose**, **key content/components**, and **design notes**. This is the surface area a design pass should cover.

### 5.1 Login
- **Purpose:** phone-number + password sign-in.
- **Content:** logo badge, phone field, password field, error, primary button.
- **Design notes:** the brand's first impression. Currently a plain centered card. Opportunity for a branded, confidence-setting entry screen.

### 5.2 Dashboard (`/`)
- **Purpose:** the operational pulse — "what's happening right now and what needs me."
- **Content:**
  - **KPI row (6 StatCards):** Active vendors · Collected today (kg + ₦ owed) · Raw at intake (kg) · In processing (kg) · Finished goods (kg) · Wallet balance (₦, turns red if ≤0).
  - **Monthly output goal:** progress bar toward the tonnage target with "X kg remaining."
  - **Trips in the field:** live list of active collection trips with running kg totals and status badges.
  - **Needs attention:** aggregated alert list — flagged production jobs, payout batches awaiting funds, open receivables.
  - **Material in each stage:** grid of WIP by process stage.
- **Design notes:** this is *the* screen to get right. Currently everything is equal-weight cards. Opportunity: a genuine command-center hierarchy — hero metric(s), a prominent "exceptions/attention" zone, and a clear separation between "live activity" and "standing totals." Possibly the best home for tasteful charts (today vs target, week trend).

### 5.3 Vendors (`/vendors`)
- **Purpose:** the household-vendor registry.
- **Content:** search field; table (Vendor · Phone · Locality · Lifetime kg · Bank verified? · Status badge); "Register vendor" + "Map view" actions.
- **Design notes:** high-volume list (hundreds→thousands). Needs excellent scannability, filtering, and a strong link between list and map.

### 5.4 Register vendor (`/vendors/new`)
- **Purpose:** capture a new vendor, ideally at their house.
- **Content:** name, phone, site, locality, address; **"Pin current location"** (GPS) control; bank section (bank select + account number, verified against Paystack).
- **Design notes:** the GPS pin and bank-verification states are the interesting moments — success/verified feedback should feel reassuring.

### 5.5 Vendor map (`/vendors/map`)
- **Purpose:** see vendor density by area to plan collection routes.
- **Content:** full-bleed MapLibre map, clustered pins (green, sized/colored by density), popups linking to profiles.
- **Design notes:** the one rich-visual screen. Opportunity for a proper map UI — filters (locality, activity, last-collection), a density legend, a side list synced to the map, heat visualization.

### 5.6 Vendor profile (`/vendors/[id]`)
- **Purpose:** everything about one vendor.
- **Content:** header + status; StatCards (Lifetime collected · Lifetime earned · Bank status · Next reward tier progress); pinned-location line; weigh-in history table; payments table; reward tier progress.
- **Design notes:** a "profile" archetype reused for staff too — worth designing a strong, consistent profile layout (identity block + KPIs + activity history).

### 5.7 Trips (`/trips`) & New trip (`/trips/new`)
- **Trips list:** Date · Locality · Team lead · # weigh-ins · Collected kg · Status.
- **New trip form:** site, date, locality, vehicle, team-lead select, team-member checkboxes.
- **Design notes:** the trip has a **lifecycle** (Planned → In progress → Returned → Reconciled → Approved → Paid). A visual status stepper would help here and on trip detail.

### 5.8 Trip detail (`/trips/[id]`) — *high-value, complex*
- **Purpose:** run and reconcile one collection trip; **the core fraud-control screen.**
- **Content (state-dependent):**
  - StatCards: Total collected · Vendors visited · Owed to vendors · Team.
  - Status-action buttons (Start / Mark returned / etc.).
  - **Manifest by material** (kg per material type).
  - **Weigh-in form** (while in field): vendor + material + weight.
  - **Reconciliation table** (when returned): per material — Collected (field) vs Remitted (factory scale) vs **Variance %** vs tolerance, with a required reason when over tolerance. Variance within tolerance = green, over = red.
  - **Payout batch** summary once approved.
  - Full weigh-ins list.
- **Design notes:** the reconciliation table is where theft is caught — the collected/remitted/variance comparison must be beautifully legible. The multi-state nature (same screen changes as the trip progresses) is a real design challenge worth solving with a stepper + contextual panels.

### 5.9 Payouts (`/payouts`)
- **Purpose:** pay vendors via Paystack after approval; guard the wallet.
- **Content:** Wallet balance StatCard (red if it can't cover outstanding); "top-up" form (finance); a warning banner if balance < outstanding; per-batch cards each containing a table of vendor payouts (amount, reference, status, failure reason) with a "Release payouts" / "Retry failed" action.
- **Design notes:** money-movement screen — needs a very clear "can I afford this / is it safe to release" moment, and unmistakable success/failure states per payout.

### 5.10 Purchases (`/purchases`, `/new`, `/[id]`)
- **List:** Lot · Date · Supplier · Scaled weight · Material cost · **Landed ₦/kg** · Payment status.
- **Detail:** landed-cost StatCards (scaled weight vs field estimate variance, material cost, linked expenses, **landed cost/kg**, paid-to-supplier); scale-in form (multi-line: material + weight + price); items table; linked-expenses table; supplier-payments table + form.
- **Design notes:** "landed cost per kg" is a hero business metric — make it prominent. The field-estimate-vs-actual variance is another fraud signal.

### 5.11 Suppliers (`/suppliers`)
- Add-supplier form + table (Supplier · Type · Phone · # batches · Total supplied kg · Total value).

### 5.12 Production (`/production`) — *high-value, complex*
- **Purpose:** track material through factory stages; catch process loss/theft.
- **Content:**
  - **New job form:** site + material + stage + scale-in weight + staff assignment (multi-select).
  - **Flagged jobs** (red, top priority): jobs where in ≠ out + waste beyond tolerance, with a resolution form. **This is the theft-detection surface.**
  - **Open jobs:** in-progress work with a "scale out (good output + waste)" form.
  - **Completed** table: In · Out · Waste · **Discrepancy %** · Staff · Status.
- **Design notes:** the flagged-jobs zone deserves the strongest "exception" treatment in the whole app. The scale-in/scale-out interaction is high-frequency — make it fast and error-resistant.

### 5.13 Inventory (`/inventory`)
- StatCards (Raw at intake · In processing · Finished goods); then grouped location cards, each showing a per-material/product breakdown. All computed live from the movement ledger.
- **Design notes:** opportunity for a visual "material flow" representation (intake → stages → finished) rather than just stacked cards.

### 5.14 Materials & Stages (`/materials`)
- Create-material and create-stage forms; per-material **route editor** — an ordered chain of stage chips connected by arrows, editable.
- **Design notes:** the route editor (a visual pipeline builder) is a fun, distinctive component worth polishing.

### 5.15 Sales — Customers / Orders / Dispatches / Invoices
- **Customers:** add form + table (Customer · Contact · Terms · # orders · **Open balance**) + a **list-prices** panel with per-product current prices and a price-setter.
- **Orders (`/orders`, `/[id]`):** create-order form (customer + site + product lines); list (Order · Customer · Ordered kg · Dispatched kg · Value · Status); detail shows order lines, a **dispatch form** (scale each product at the gate), and dispatch history.
- **Dispatches:** Waybill · Date · Customer · Goods · Vehicle · Invoice · Status.
- **Invoices:** **receivables aging** StatCards (Current / 1–30 / 31–60 / 60+ overdue) + table with inline "record payment" form; overdue rows flagged.
- **Design notes:** the aging buckets are a classic finance visual — could be a segmented bar. Invoice/dispatch/order form a mini-lifecycle worth making legible.

### 5.16 People — Staff / Payroll / PPE & Logs
- **Staff list:** Staff no · Name · Phone · Role badges · Hired · Status.
- **Register staff:** long form — bio, roles (multi), bank, next-of-kin, emergency contact.
- **Staff profile (`/staff/[id]`):** **auto-generated ID card with QR code** (used to log into factory scale stations!) rendered on screen; StatCards (earned, outstanding advance); recent jobs; wage history; salary advances (+ grant form); PPE/equipment issuances (+ form); medical/reward/disciplinary logs (+ form).
- **Payroll:** "open this week's run" buttons; per-run cards with a table (Staff · Earned · Advance deducted · Net pay · Payment status) + "mark paid."
- **PPE & Logs:** company-wide tables of issuances, staff logs, advances.
- **Design notes:** the **ID card** is a real design artifact (it gets printed) — give it a proper, credential-worthy design. The staff profile is dense; needs strong sectioning.

### 5.17 Finance — Expenses / Wallet / Budgets / Reports
- **Expenses:** record-expense form (category, amount, optional link to a purchase batch or trip, receipt) + table.
- **Wallet:** balance + in/out StatCards; append-only ledger table (topup/payout/fee/refund) with signed amounts.
- **Budgets:** set-budget and set-target forms; **budget vs actual** table with per-category progress bars (green/amber/red by % used); targets table.
- **Reports (`/reports`):** month picker; **full P&L table** (Revenue − COGS[vendor cost + purchases + direct expenses + wages] = Gross → − opex = Net); operational KPI StatCards (finished output vs target, collected, purchased, **waste & losses**); **unit economics** (cost per finished kg, revenue per kg, margin per kg); waste-by-material table.
- **Design notes:** Reports is almost all tables today — the single biggest **data-visualization opportunity**: P&L waterfall, output-vs-target gauge, margin-per-kg, waste breakdown. This is what the CEO looks at.

### 5.18 Settings
- Operational thresholds (min pickup kg, collection tolerance %, production tolerance %, payout SLA, advance cap %); vendor price rates (per material) + setter; piece rates (per stage × material) + setter; sites list + add; localities list + add; reward tiers + add.
- **Design notes:** a lot of config crammed into one page — could use tabs/sections and clearer grouping.

---

## 6. Field mobile app (Android, offline-first)

Six screens, big-touch, sunlight-legible. Emerald-forward.

1. **Login** — logo, phone + password, big button.
2. **Home** — greeting card (name + role); large tap tiles: *Register vendor*, *My trips*, *Pending sync (N)*; sign out. Tile borders use the accent as a left rail.
3. **Register vendor** — name, phone, address; **"Pin current location"** button (turns into a confirmed pin state); locality chips; bank chips + account number. Saves offline if no network (with reassuring "saved offline, will sync" messaging).
4. **My trips** — pull-to-refresh list of the agent's active trips with kg/₦ running totals.
5. **Weigh-in (`trip/[id]`)** — *the core, highest-frequency action:* searchable vendor picker → material chips → **big centered weight input** → record. Shows "N weigh-ins recorded this session." GPS-stamped, offline-safe.
6. **Pending sync (outbox)** — list of queued records with timestamps and any last error; "Sync now" button.

**Design notes:** the weigh-in screen should feel like a **confident, glove-friendly scale companion** — huge numeric input, unmistakable confirm, zero ambiguity about whether a record saved (online vs queued). The offline/outbox concept should feel *safe and in-control*, never like data loss. Chips over dropdowns wherever possible. This app is used outdoors in sun — contrast and target size are paramount.

---

## 7. Cross-cutting design requirements

1. **Numbers are the hero.** Money and weight must be tabular, aligned, and instantly scannable. Preserve/strengthen the mono-for-numbers system. Always show units (₦, kg).
2. **Status is a system, not a color.** ~35 statuses across the app use a shared badge+tone map. Design a coherent status language (shape/icon/label + color) that works for color-blind users and never relies on hue alone.
3. **Exceptions must dominate when present.** Flagged jobs, over-tolerance variances, failed payouts, overdue invoices, insufficient wallet — these should visually outrank routine data. A consistent "attention" pattern across the app.
4. **Reconciliation/variance is the signature interaction.** The "expected vs actual → delta → within/over tolerance → approve" pattern recurs (trips, purchases, production). A signature visual treatment for it would unify the product.
5. **Light-first, high-contrast, WCAG AA minimum** (AAA where feasible). Dark mode must remain fully supported.
6. **Role-adaptive layouts** — the same screen may show fewer actions to lower roles; design should degrade gracefully.
7. **Empty/first-run states** matter — the client starts from zero data. Make them instructive and encouraging.
8. **Responsive** — admin is used on 1440px monitors *and* factory tablets (~768–1024px). Tables must remain usable; consider card-fallback layouts on narrow widths.
9. **Print** — the staff ID card and (future) invoices/waybills are printed; design print-friendly artifacts.
10. **Brand** — evolve a real Zyntomax identity (logo, mark, color refinement, a bit of warmth) that reads as trustworthy, modern, and distinctly Nigerian-industrial without being generic.

---

## 8. Explicitly out of scope for this design pass
- Changing the data model, business logic, roles, or feature set.
- The future Vendor self-service app.
- Backend/API changes.

The ask is **visual design, layout, hierarchy, componentry, information design, data-viz, and interaction polish** on the surfaces above — delivered as design direction the existing Next.js (Tailwind v4 + tokenized CSS) and Expo/React Native codebases can adopt.

---

## 9. Quick reference — the 5 screens that matter most
If prioritizing, these carry the most product value and have the most design upside:
1. **Dashboard** — the command center.
2. **Trip detail / reconciliation** — the signature fraud-control flow.
3. **Production (flagged jobs)** — the theft-detection surface.
4. **Reports** — the CEO's P&L + unit-economics view (biggest data-viz opportunity).
5. **Field weigh-in (mobile)** — the highest-frequency real-world action.
