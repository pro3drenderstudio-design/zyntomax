"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@zyntomax/db";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { createTransferRecipient, resolveAccount } from "@/lib/paystack";

const vendorSchema = z.object({
  name: z.string().min(2),
  phone: z.string().regex(/^0\d{10}$/, "Enter an 11-digit Nigerian phone number"),
  address: z.string().optional(),
  siteId: z.string().min(1),
  localityId: z.string().optional(),
  lat: z.coerce.number().optional(),
  lng: z.coerce.number().optional(),
  bankCode: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNo: z.string().optional(),
});

export type VendorFormState = { error?: string };

export async function createVendor(
  _prev: VendorFormState,
  formData: FormData,
): Promise<VendorFormState> {
  const session = await requireRole([
    "OPERATIONS_MANAGER",
    "COLLECTION_AGENT",
    "TEAM_LEAD",
  ]);

  const raw = Object.fromEntries(formData.entries());
  const parsed = vendorSchema.safeParse({
    ...raw,
    lat: raw.lat || undefined,
    lng: raw.lng || undefined,
    localityId: raw.localityId || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }
  const data = parsed.data;

  const existing = await prisma.vendor.findUnique({ where: { phone: data.phone } });
  if (existing) return { error: "A vendor with this phone number already exists." };

  // Verify bank account against Paystack when provided
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
      return {
        error:
          "Bank account could not be verified. Check the account number and bank.",
      };
    }
  }

  const vendor = await prisma.vendor.create({
    data: {
      name: data.name,
      phone: data.phone,
      address: data.address,
      siteId: data.siteId,
      localityId: data.localityId,
      lat: data.lat,
      lng: data.lng,
      bankName: data.bankName,
      bankAccountNo: data.bankAccountNo,
      bankAccountName,
      bankVerified,
      paystackRecipient,
      registeredById: session.userId,
    },
  });

  await audit({
    actorId: session.userId,
    action: "vendor.create",
    entity: "Vendor",
    entityId: vendor.id,
    after: { name: vendor.name, phone: vendor.phone },
  });

  revalidatePath("/vendors");
  redirect(`/vendors/${vendor.id}`);
}

export async function setVendorStatus(vendorId: string, status: "ACTIVE" | "INACTIVE" | "BLACKLISTED") {
  const session = await requireRole(["OPERATIONS_MANAGER"]);
  const before = await prisma.vendor.findUniqueOrThrow({ where: { id: vendorId } });
  await prisma.vendor.update({ where: { id: vendorId }, data: { status } });
  await audit({
    actorId: session.userId,
    action: "vendor.status",
    entity: "Vendor",
    entityId: vendorId,
    before: { status: before.status },
    after: { status },
  });
  revalidatePath(`/vendors/${vendorId}`);
  revalidatePath("/vendors");
}
