# Production & Inventory Model (v2) — design

## The core realization

**Everything is a Material with a lifecycle state.** Raw purchased stock, sorted
sub-streams, and finished goods are all *materials* — they differ only in where
they sit in the process. A stage doesn't push "the same material" forward; it
**transforms** an input material into one or more *different* output materials.

Only the output of an **end-of-line** step is a finished (sellable) product.
An output produced mid-line is an **intermediate material still in processing**,
and it becomes the **input** to the next stage.

## Materials

One catalog (`Material`) replaces today's split of MaterialType / StageOutput /
Product. Each material has:

| Field | Meaning |
|---|---|
| `name` | "General Plastics", "PP White", "HDPE", "Crushed HDPE" |
| `kind` | **RAW** (purchased), **INTERMEDIATE** (in processing), **FINISHED** (sellable) |
| `color` | colour tag for the UI |

`kind` decides the inventory bucket and whether it can be sold. "Only end-of-line
outputs are finished" = the admin marks crushing's outputs FINISHED and sorting's
outputs INTERMEDIATE. (Guided in the UI, but explicit so you stay in control.)

## Recipes (what each stage does)

A recipe says *"at stage S, input material I yields output materials [O1, O2 …]"*:

```
(Sorting,  General Plastics) → PP White, PP Blue, HDPE, Masterbatch   (all INTERMEDIATE)
(Crushing, HDPE)             → Crushed HDPE                            (FINISHED)
(Crushing, PP Blue)          → Crushed PP Blue                         (FINISHED)
(Crushing, PP White)         → Crushed PP White                       (FINISHED)   [defined even if not run yet]
```

This replaces the old linear `MaterialRoute`. A stage can process several input
materials, each with its own set of outputs. The graph can branch and re-converge.

## Jobs = transformations

A job: **stage + input material + weight-in + assigned staff**.

- **Create**: consume `weightIn` of the input material from where it lives
  (raw → intake; intermediate → the in-processing pool). It moves into that
  stage's active-work bucket.
- **Complete**: scale out each **output material** (by weight) + waste. The job
  is mass-balanced: `Σ outputs + waste + discrepancy = weightIn`. Each output
  lands in its bucket by kind (INTERMEDIATE → in-processing pool; FINISHED →
  finished store). Waste and unaccounted loss → waste.

Discrepancy tolerance, flagging, and pay (scale-in vs scale-out, charge-backs)
work exactly as they do today.

## Inventory — three clear buckets

1. **Pre-processing (raw):** each RAW material at intake — *General Plastics 4000 kg*.
2. **In processing (intermediate):**
   - *Waiting:* INTERMEDIATE materials produced but not yet assigned onward
     — *PP White 500 kg, Masterbatch 50 kg*.
   - *Active:* what's being worked right now, per stage — *Crushing: HDPE 300 kg*.
3. **Finished goods:** each FINISHED material — *Crushed HDPE 280 kg, Crushed PP Blue 90 kg*.

### Processing history
Every transformation is already a ledger entry (job, stage, staff, time). So each
material gets a **history**: produced by which job/stage/staff, and consumed by
which downstream job/stage/staff — the full trail as it passes between stages and
people.

## Sales
Only **FINISHED** materials with stock are sellable, capped at available quantity
(the availability logic just built stays; it points at finished materials).

## Your scenario, traced

Purchase **5000 kg General Plastics** → intake GP 5000.

**Sorting** — assign 1000 kg GP → outputs 500 PP White, 100 PP Blue, 300 HDPE,
50 Masterbatch, 50 waste:
- intake GP → **4000** ✓
- in-processing: PP White 500, PP Blue 100, HDPE 300, Masterbatch 50

**Crushing** — assign 300 HDPE + 100 PP Blue → 280 Crushed HDPE, 90 Crushed PP Blue:
- in-processing HDPE → 0, PP Blue → 0 (consumed)
- finished: Crushed HDPE **280**, Crushed PP Blue **90** ✓

**Final inventory (exactly your list):**
- Raw: **General Plastics 4000 kg**
- In processing: **PP White 500 kg** (+ Masterbatch 50 kg)
- Finished: **Crushed HDPE 280 kg**, **Crushed PP Blue 90 kg**

## Migration from today
- `MaterialType` becomes the Material catalog (+ `kind`, `color`). Existing types
  (PET, General Plastics…) → RAW.
- Existing `Product` rows (PET Pellets…) → FINISHED materials; `PriceList`,
  `SalesOrderItem`, sales/inventory repoint from Product → Material. Product table
  retired.
- `StageOutput` becomes a recipe row `(stageId, inputMaterialId, outputMaterialId)`.
- `MaterialRoute` retired (recipes define routing).
- `JobOutput` references the output material.
- Inventory locations simplify: INTAKE, IN_PROCESSING (pool), STAGE_WIP (active),
  FINISHED_STORE, WASTE, VENDOR_GATE, VEHICLE, CUSTOMER.

## Build phases
1. Schema + migration (materials, recipes, kinds; retire Product/MaterialRoute).
2. Materials admin: define materials (kind, colour) + recipes per stage.
3. Production: job create (input material with stock → stage) + scale-out to
   output materials; transformation movements.
4. Inventory: three-bucket view + per-material processing history.
5. Sales: finished-material availability (repoint).
6. Reports/dashboard/e2e updates; verify the full loop still balances.
