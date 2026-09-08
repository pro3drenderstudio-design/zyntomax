import { NextResponse, type NextRequest } from "next/server";
import { prisma, type Prisma } from "@zyntomax/db";
import { z } from "zod";
import { mobileSession, mobileHasRole } from "@/lib/mobile-auth";
import { accessibleSiteIds } from "@/lib/auth";
import { resolveAccount, createTransferRecipient } from "@/lib/paystack";
import { audit } from "@/lib/audit";

const VIEW_ROLES = ["COLLECTION_AGENT", "TEAM_LEAD", "OPERATIONS_MANAGER", "FACTORY_SUPERVISOR"] as const;
const STATUSES = ["PENDING", "ACTIVE", "INACTIVE", "BLACKLISTED"] as const;

/** Vendor directory for staff: status filter, search, pagination + lifetime kg. */
export async function GET(request: NextRequest) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mobileHasRole(session, [...VIEW_ROLES])) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const statusParam = sp.get("status") ?? "";
  const q = (sp.get("q") ?? "").trim();
  const page = Math.max(0, Number(sp.get("page") ?? 0) || 0);
  const PAGE_SIZE = 30;
  const siteIds = accessibleSiteIds(session);

  const where: Prisma.VendorWhereInput = {
    ...(siteIds ? { siteId: { in: siteIds } } : {}),
    ...(STATUSES.includes(statusParam as (typeof STATUSES)[number]) ? { status: statusParam as (typeof STATUSES)[number] } : {}),
    ...(q.length >= 2
      ? { OR: [
          { name: { contains: q, mode: "insensitive" } },
          { nickname: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { vendorNo: { contains: q, mode: "insensitive" } },
        ] }
      : {}),
  };

  const [rows, total, pendingCount] = await Promise.all([
    prisma.vendor.findMany({
      where,
      include: { locality: true, weighIns: { select: { weightKg: true } } },
      orderBy: { createdAt: "desc" },
      skip: page * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.vendor.count({ where }),
    prisma.vendor.count({ where: { ...(siteIds ? { siteId: { in: siteIds } } : {}), status: "PENDING" } }),
  ]);

  return NextResponse.json({
    total,
    pendingCount,
    page,
    hasMore: (page + 1) * PAGE_SIZE < total,
    vendors: rows.map((v) => ({
      id: v.id,
      vendorNo: v.vendorNo,
      name: v.name,
      nickname: v.nickname,
      phone: v.phone,
      photoUrl: v.photoUrl,
      locality: v.locality?.name ?? null,
      status: v.status,
      bankVerified: v.bankVerified,
      lat: v.lat === null ? null : Number(v.lat),
      lng: v.lng === null ? null : Number(v.lng),
      lifetimeKg: v.weighIns.reduce((s, w) => s + Number(w.weightKg), 0),
    })),
  });
}

const vendorSchema = z.object({
  clientUuid: z.string().min(8), // idempotency for the offline queue
  name: z.string().min(2),
  phone: z.string().regex(/^0\d{10}$/),
  address: z.string().optional(),
  siteId: z.string().min(1),
  localityId: z.string().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  bankCode: z.string().optional().nullable(),
  bankName: z.string().optional().nullable(),
  bankAccountNo: z.string().optional().nullable(),
});

export async function POST(request: NextRequest) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mobileHasRole(session, ["COLLECTION_AGENT", "TEAM_LEAD", "OPERATIONS_MANAGER"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = vendorSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }
  const data = parsed.data;

  // Idempotent: same phone = same vendor (offline retry safe)
  const existing = await prisma.vendor.findUnique({ where: { phone: data.phone } });
  if (existing) {
    return NextResponse.json({ id: existing.id, deduped: true });
  }

  let bankAccountName: string | undefined;
  let bankVerified = false;
  let paystackRecipient: string | undefined;
  if (data.bankAccountNo && data.bankCode) {
    try {
      const resolved = await resolveAccount(data.bankAccountNo, data.bankCode);
      bankAccountName = resolved.account_name;
      bankVerified = true;
      const recipient = await createTransferRecipient({
        name: resolved.account_name,
        accountNumber: data.bankAccountNo,
        bankCode: data.bankCode,
      });
      paystackRecipient = recipient.recipient_code;
    } catch {
      // Bank verification can be completed later from the admin; register anyway
    }
  }

  const vendor = await prisma.vendor.create({
    data: {
      name: data.name,
      phone: data.phone,
      address: data.address ?? undefined,
      siteId: data.siteId,
      localityId: data.localityId ?? undefined,
      lat: data.lat ?? undefined,
      lng: data.lng ?? undefined,
      bankName: data.bankName ?? undefined,
      bankAccountNo: data.bankAccountNo ?? undefined,
      bankAccountName,
      bankVerified,
      paystackRecipient,
      registeredById: session.userId,
    },
  });

  await audit({
    actorId: session.userId,
    action: "vendor.create.mobile",
    entity: "Vendor",
    entityId: vendor.id,
    after: { name: vendor.name, phone: vendor.phone },
  });

  return NextResponse.json({ id: vendor.id, bankVerified, deduped: false });
}
