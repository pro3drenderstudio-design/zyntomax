import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { z } from "zod";
import { mobileSession, mobileHasRole } from "@/lib/mobile-auth";
import { audit } from "@/lib/audit";
import { vendorBalance } from "@/lib/vendor-wallet";
import { verifyBank, deleteVendorById } from "@/lib/vendors";

const VIEW_ROLES = ["COLLECTION_AGENT", "TEAM_LEAD", "OPERATIONS_MANAGER", "FACTORY_SUPERVISOR"] as const;

/** Vendor detail: profile, wallet, weigh-ins, withdrawals, payouts. */
export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mobileHasRole(session, [...VIEW_ROLES])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;

  const v = await prisma.vendor.findUnique({
    where: { id },
    include: {
      locality: true,
      weighIns: { include: { materialType: true }, orderBy: { createdAt: "desc" }, take: 30 },
      withdrawals: { orderBy: { requestedAt: "desc" }, take: 20 },
      payouts: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!v) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const balance = await vendorBalance(id);
  const lifetimeKg = v.weighIns.reduce((s, w) => s + Number(w.weightKg), 0);

  return NextResponse.json({
    id: v.id,
    vendorNo: v.vendorNo,
    name: v.name,
    nickname: v.nickname,
    phone: v.phone,
    photoUrl: v.photoUrl,
    address: v.address,
    status: v.status,
    locality: v.locality?.name ?? null,
    localityId: v.localityId,
    lat: v.lat === null ? null : Number(v.lat),
    lng: v.lng === null ? null : Number(v.lng),
    bankName: v.bankName,
    bankAccountNo: v.bankAccountNo,
    bankAccountName: v.bankAccountName,
    bankVerified: v.bankVerified,
    referralCode: v.referralCode,
    createdAt: v.createdAt,
    wallet: balance,
    lifetimeKg,
    weighIns: v.weighIns.map((w) => ({
      id: w.id, createdAt: w.createdAt, material: w.materialType.name,
      weightKg: Number(w.weightKg), ratePerKg: Number(w.ratePerKg), amount: Number(w.amount), confirmation: w.confirmation,
    })),
    withdrawals: v.withdrawals.map((w) => ({
      id: w.id, amount: Number(w.amount), status: w.status, requestedAt: w.requestedAt, failureReason: w.failureReason,
    })),
    payouts: v.payouts.map((p) => ({
      id: p.id, amount: Number(p.amount), status: p.status, paystackRef: p.paystackRef, createdAt: p.createdAt,
    })),
  });
}

const updateSchema = z.object({
  name: z.string().min(2),
  nickname: z.string().optional().nullable(),
  phone: z.string().regex(/^0\d{10}$/),
  address: z.string().optional().nullable(),
  localityId: z.string().optional().nullable(),
  bankCode: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  bankAccountNo: z.string().optional().nullable(),
});

/** Edit a vendor's profile (re-verifies bank only when the account changes). */
export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mobileHasRole(session, ["OPERATIONS_MANAGER", "TEAM_LEAD"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 422 });
  const data = parsed.data;

  const current = await prisma.vendor.findUnique({ where: { id } });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (data.phone !== current.phone) {
    const clash = await prisma.vendor.findUnique({ where: { phone: data.phone } });
    if (clash) return NextResponse.json({ error: "Another vendor already uses this phone number." }, { status: 409 });
  }

  let bankFields = {};
  if (data.bankAccountNo && data.bankCode && data.bankAccountNo !== current.bankAccountNo) {
    try {
      const bank = await verifyBank(data.bankAccountNo, data.bankCode);
      bankFields = { bankAccountName: bank.bankAccountName, bankVerified: bank.bankVerified, paystackRecipient: bank.paystackRecipient };
    } catch {
      return NextResponse.json({ error: "Bank account could not be verified." }, { status: 422 });
    }
  }

  await prisma.vendor.update({
    where: { id },
    data: {
      name: data.name,
      nickname: data.nickname ?? null,
      phone: data.phone,
      address: data.address ?? null,
      localityId: data.localityId ?? null,
      bankName: data.bankName ?? current.bankName,
      bankAccountNo: data.bankAccountNo ?? current.bankAccountNo,
      ...bankFields,
    },
  });
  await audit({ actorId: session.userId, action: "vendor.update", entity: "Vendor", entityId: id, after: { name: data.name } });
  return NextResponse.json({ ok: true });
}

/** Delete a vendor (soft-blacklist if it has collection history). */
export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mobileHasRole(session, ["OPERATIONS_MANAGER"])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const res = await deleteVendorById(id, session.userId);
  return NextResponse.json({ ok: true, softDeleted: res.softDeleted });
}
