import { NextResponse } from "next/server";
import { prisma } from "@zyntomax/db";
import { createTrip, addWeighIn, setTripStatus, reconcileTrip, approveTrip } from "@/app/(app)/trips/actions";
import { releaseBatch } from "@/app/(app)/payouts/actions";
import { createPurchaseBatch, scaleInBatch } from "@/app/(app)/purchases/actions";
import { createJob, completeJob } from "@/app/(app)/production/actions";
import { createPayrollRun } from "@/app/(app)/payroll/actions";
import { createOrder, createDispatch, recordCustomerPayment } from "@/app/(app)/orders/actions";
import { locationBalances } from "@/lib/inventory";

/**
 * DEV ONLY — drives the full business loop through the real server actions.
 * Collection → reconciliation → payout; purchase → production → finished goods;
 * payroll; sale → dispatch → invoice → payment. Returns invariant checks.
 */

function fd(entries: Record<string, string | string[]>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) {
    if (Array.isArray(v)) v.forEach((x) => f.append(k, x));
    else f.append(k, v);
  }
  return f;
}

async function swallowRedirect<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) return undefined;
    if ((e as { digest?: string }).digest?.includes("NEXT_REDIRECT")) return undefined;
    throw e;
  }
}

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const log: string[] = [];
  const fail = (msg: string) => NextResponse.json({ ok: false, error: msg, log }, { status: 500 });

  // ── Resolve master data ────────────────────────────────────────────
  const site = await prisma.site.findFirstOrThrow();
  const locality = await prisma.locality.findFirstOrThrow({ where: { name: "Agege" } });
  const vendors = await prisma.vendor.findMany({ where: { localityId: locality.id }, take: 2 });
  const pet = await prisma.materialType.findUniqueOrThrow({ where: { name: "PET" } });
  const alu = await prisma.materialType.findUniqueOrThrow({ where: { name: "Aluminium" } });
  const lead = await prisma.staffProfile.findFirstOrThrow({
    where: { user: { roles: { some: { role: "TEAM_LEAD" } } } },
  });
  const sorters = await prisma.staffProfile.findMany({
    where: { user: { roles: { some: { role: "PRODUCTION_STAFF" } } } },
    take: 4,
  });
  const supplier = await prisma.supplier.findFirstOrThrow();
  const customer = await prisma.customer.findFirstOrThrow({ where: { name: "Lagos Polymer Industries" } });

  // ── 1. Collection trip ─────────────────────────────────────────────
  await swallowRedirect(() =>
    createTrip({}, fd({
      siteId: site.id,
      localityId: locality.id,
      leadId: lead.id,
      vehicle: "Truck GGE-234-XA",
      date: new Date().toISOString().slice(0, 10),
    })),
  );
  const trip = await prisma.trip.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
  log.push(`Trip created: ${trip.id}`);

  let r = await addWeighIn({}, fd({ tripId: trip.id, vendorId: vendors[0].id, materialTypeId: pet.id, weightKg: "60" }));
  if (r.error) return fail(`weighIn1: ${r.error}`);
  r = await addWeighIn({}, fd({ tripId: trip.id, vendorId: vendors[1].id, materialTypeId: alu.id, weightKg: "25" }));
  if (r.error) return fail(`weighIn2: ${r.error}`);
  log.push("2 weigh-ins recorded (60kg PET, 25kg Aluminium)");

  await setTripStatus(trip.id, "RETURNED");
  r = await reconcileTrip({}, fd({
    tripId: trip.id,
    [`remitted_${pet.id}`]: "59",
    [`remitted_${alu.id}`]: "25",
    [`reason_${pet.id}`]: "",
    [`reason_${alu.id}`]: "",
  }));
  if (r.error) return fail(`reconcile: ${r.error}`);
  await approveTrip(trip.id);
  log.push("Trip reconciled (59kg PET, 25kg Alu remitted) and approved");

  const batch = await prisma.payoutBatch.findUniqueOrThrow({ where: { tripId: trip.id } });
  await releaseBatch(batch.id);
  const payouts = await prisma.payout.findMany({ where: { batchId: batch.id } });
  if (!payouts.every((p) => p.status === "SUCCESS")) return fail("payouts did not all succeed");
  log.push(`Payout batch released: ₦${Number(batch.totalAmount).toLocaleString()} to ${payouts.length} vendors (simulated Paystack)`);

  // ── 2. Purchase batch ──────────────────────────────────────────────
  await swallowRedirect(() =>
    createPurchaseBatch({}, fd({ siteId: site.id, supplierId: supplier.id, fieldEstKg: "520" })),
  );
  const pBatch = await prisma.purchaseBatch.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
  r = await scaleInBatch({}, fd({
    batchId: pBatch.id,
    materialTypeId: [pet.id],
    weightKg: ["500"],
    pricePerKg: ["180"],
  }));
  if (r.error) return fail(`scaleIn: ${r.error}`);
  log.push(`Purchase ${pBatch.lotNo}: 500kg PET scaled in @ ₦180/kg`);

  // ── 3. Production: PET route Sorting → Crushing → Washing → Pelletizing ──
  const stages = ["Sorting", "Crushing", "Washing", "Pelletizing"];
  const weights: [number, number, number][] = [
    [300, 280, 15], // in, out, waste — 5kg (1.7%) within 2% tolerance
    [280, 270, 8],
    [270, 265, 4.5],
    [265, 260, 4],
  ];
  for (let i = 0; i < stages.length; i++) {
    const stage = await prisma.processStage.findUniqueOrThrow({ where: { name: stages[i] } });
    const [inKg, outKg, wasteKg] = weights[i];
    r = await createJob({}, fd({
      siteId: site.id,
      stageId: stage.id,
      materialTypeId: pet.id,
      weightInKg: String(inKg),
      staffIds: sorters.slice(0, 2).map((s) => s.id),
    }));
    if (r.error) return fail(`createJob ${stages[i]}: ${r.error}`);
    const job = await prisma.job.findFirstOrThrow({
      where: { stageId: stage.id, status: "IN_PROGRESS" },
      orderBy: { startedAt: "desc" },
    });
    r = await completeJob({}, fd({ jobId: job.id, weightOutKg: String(outKg), wasteKg: String(wasteKg) }));
    if (r.error) return fail(`completeJob ${stages[i]}: ${r.error}`);
    log.push(`${stages[i]}: ${inKg}kg in → ${outKg}kg out + ${wasteKg}kg waste`);
  }

  // ── 4. Payroll ─────────────────────────────────────────────────────
  await createPayrollRun(site.id);
  const run = await prisma.payrollRun.findFirstOrThrow({
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });
  const totalWages = run.items.reduce((s, i) => s + Number(i.earnedAmount), 0);
  if (run.items.length === 0) return fail("payroll produced no items");
  log.push(`Payroll run opened: ${run.items.length} staff, ₦${totalWages.toLocaleString()} earned`);

  // ── 5. Sales: order → dispatch → invoice → payment ────────────────
  const product = await prisma.product.findUniqueOrThrow({ where: { name: "PET Pellets" } });
  await swallowRedirect(() =>
    createOrder({}, fd({
      customerId: customer.id,
      siteId: site.id,
      productId: [product.id],
      qtyKg: ["200"],
    })),
  );
  const order = await prisma.salesOrder.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
  r = await createDispatch({}, fd({
    orderId: order.id,
    vehicle: "Truck LSD-889-KJA",
    driverName: "Musa Danjuma",
    productId: [product.id],
    weightKg: ["200"],
  }));
  if (r.error) return fail(`dispatch: ${r.error}`);
  const invoice = await prisma.invoice.findFirstOrThrow({ orderBy: { createdAt: "desc" } });
  r = await recordCustomerPayment({}, fd({
    invoiceId: invoice.id,
    amount: "100000",
    method: "TRANSFER",
    reference: "FBN/TRF/0091",
  }));
  if (r.error) return fail(`payment: ${r.error}`);
  log.push(`Order ${order.orderNo} → dispatched 200kg → ${invoice.invoiceNo} ₦${Number(invoice.amount).toLocaleString()} → ₦100,000 received`);

  // ── Invariant checks ───────────────────────────────────────────────
  const balances = await locationBalances(null);
  const walletAgg = await prisma.walletTransaction.aggregate({ _sum: { amount: true } });
  const intake = balances.filter((b) => b.kind === "INTAKE").reduce((s, b) => s + b.totalKg, 0);
  const wip = balances.filter((b) => b.kind === "STAGE_WIP").reduce((s, b) => s + b.totalKg, 0);
  const finished = balances.filter((b) => b.kind === "FINISHED_STORE").reduce((s, b) => s + b.totalKg, 0);
  const vehicle = balances.filter((b) => b.kind === "VEHICLE").reduce((s, b) => s + b.totalKg, 0);

  const checks = {
    // 59 PET + 25 Alu remitted + 500 purchased − 300 assigned to sorting = 284
    intakeExpected284: Math.abs(intake - 284) < 0.01,
    // 300−280 out at sorting stays as... all moved through; WIP = leftovers between stages: 0? Sorting got 300, out 280→Crushing; Crushing took 280 (all), etc. Pelletizing out 260 → finished. WIP left: none (each stage consumed its inflow fully except within-tolerance losses went to WASTE)
    wipExpectedZero: Math.abs(wip) < 0.01,
    // 260 produced − 200 dispatched = 60
    finishedExpected60: Math.abs(finished - 60) < 0.01,
    vehicleExpectedZero: Math.abs(vehicle) < 0.01,
    // 500,000 − 32,000 payouts = 468,000
    walletExpected468k: Math.abs(Number(walletAgg._sum.amount ?? 0) - 468000) < 0.01,
  };

  const allOk = Object.values(checks).every(Boolean);
  return NextResponse.json({
    ok: allOk,
    checks,
    actuals: { intake, wip, finished, vehicle, wallet: Number(walletAgg._sum.amount ?? 0) },
    log,
  });
}
