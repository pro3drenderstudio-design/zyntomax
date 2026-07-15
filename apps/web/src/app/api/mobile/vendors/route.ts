import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { z } from "zod";
import { mobileSession, mobileHasRole } from "@/lib/mobile-auth";
import { resolveAccount, createTransferRecipient } from "@/lib/paystack";
import { audit } from "@/lib/audit";

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
