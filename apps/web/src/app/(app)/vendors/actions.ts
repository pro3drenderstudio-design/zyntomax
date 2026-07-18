"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@zyntomax/db";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { createTransferRecipient, resolveAccount } from "@/lib/paystack";
import { nextVendorNo } from "@/lib/ids";

const vendorSchema = z.object({
  name: z.string().min(2, "Full name is required"),
  nickname: z.string().optional(),
  phone: z.string().regex(/^0\d{10}$/, "Enter an 11-digit Nigerian phone number"),
  photoUrl: z.string().optional(),
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

async function verifyBank(bankAccountNo?: string, bankCode?: string) {
  if (!bankAccountNo || !bankCode) {
    return { bankAccountName: undefined, bankVerified: false, paystackRecipient: undefined };
  }
  const resolved = await resolveAccount(bankAccountNo, bankCode);
  const recipient = await createTransferRecipient({
    name: resolved.account_name,
    accountNumber: bankAccountNo,
    bankCode,
  });
  return {
    bankAccountName: resolved.account_name,
    bankVerified: true,
    paystackRecipient: recipient.recipient_code,
  };
}

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
    nickname: raw.nickname || undefined,
    photoUrl: raw.photoUrl || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const existing = await prisma.vendor.findUnique({ where: { phone: data.phone } });
  if (existing) return { error: "A vendor with this phone number already exists." };

  let bank;
  try {
    bank = await verifyBank(data.bankAccountNo, data.bankCode);
  } catch {
    return { error: "Bank account could not be verified. Check the account number and bank." };
  }

  const vendor = await prisma.vendor.create({
    data: {
      vendorNo: await nextVendorNo(),
      name: data.name,
      nickname: data.nickname,
      phone: data.phone,
      photoUrl: data.photoUrl,
      address: data.address,
      siteId: data.siteId,
      localityId: data.localityId,
      lat: data.lat,
      lng: data.lng,
      bankName: data.bankName,
      bankAccountNo: data.bankAccountNo,
      bankAccountName: bank.bankAccountName,
      bankVerified: bank.bankVerified,
      paystackRecipient: bank.paystackRecipient,
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

export async function updateVendor(
  _prev: VendorFormState,
  formData: FormData,
): Promise<VendorFormState> {
  const session = await requireRole(["OPERATIONS_MANAGER", "TEAM_LEAD"]);
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing vendor." };

  const raw = Object.fromEntries(formData.entries());
  const parsed = vendorSchema.safeParse({
    ...raw,
    lat: raw.lat || undefined,
    lng: raw.lng || undefined,
    localityId: raw.localityId || undefined,
    nickname: raw.nickname || undefined,
    photoUrl: raw.photoUrl || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const current = await prisma.vendor.findUniqueOrThrow({ where: { id } });

  // Phone uniqueness (if changed)
  if (data.phone !== current.phone) {
    const clash = await prisma.vendor.findUnique({ where: { phone: data.phone } });
    if (clash) return { error: "Another vendor already uses this phone number." };
  }

  // Re-verify bank only if the account details changed
  let bankFields = {};
  if (
    data.bankAccountNo &&
    data.bankCode &&
    (data.bankAccountNo !== current.bankAccountNo)
  ) {
    try {
      const bank = await verifyBank(data.bankAccountNo, data.bankCode);
      bankFields = {
        bankAccountName: bank.bankAccountName,
        bankVerified: bank.bankVerified,
        paystackRecipient: bank.paystackRecipient,
      };
    } catch {
      return { error: "Bank account could not be verified." };
    }
  }

  await prisma.vendor.update({
    where: { id },
    data: {
      name: data.name,
      nickname: data.nickname ?? null,
      phone: data.phone,
      photoUrl: data.photoUrl ?? null,
      address: data.address ?? null,
      localityId: data.localityId ?? null,
      lat: data.lat ?? null,
      lng: data.lng ?? null,
      bankName: data.bankName ?? current.bankName,
      bankAccountNo: data.bankAccountNo ?? current.bankAccountNo,
      ...bankFields,
    },
  });

  await audit({
    actorId: session.userId,
    action: "vendor.update",
    entity: "Vendor",
    entityId: id,
    after: { name: data.name },
  });

  revalidatePath("/vendors");
  revalidatePath(`/vendors/${id}`);
  redirect(`/vendors/${id}`);
}

export async function setVendorStatus(
  vendorId: string,
  status: "ACTIVE" | "INACTIVE" | "BLACKLISTED",
) {
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

export async function deleteVendor(vendorId: string) {
  const session = await requireRole(["OPERATIONS_MANAGER"]);

  // A vendor with collection history must not be hard-deleted (it would orphan
  // ledger and payout records). Blacklist instead; only delete if never used.
  const weighIns = await prisma.collectionWeighIn.count({ where: { vendorId } });
  if (weighIns > 0) {
    await prisma.vendor.update({ where: { id: vendorId }, data: { status: "BLACKLISTED" } });
    await audit({
      actorId: session.userId,
      action: "vendor.soft_delete",
      entity: "Vendor",
      entityId: vendorId,
    });
    revalidatePath("/vendors");
    redirect("/vendors");
  }

  await prisma.pickupRequest.deleteMany({ where: { vendorId } });
  await prisma.vendor.delete({ where: { id: vendorId } });
  await audit({
    actorId: session.userId,
    action: "vendor.delete",
    entity: "Vendor",
    entityId: vendorId,
  });
  revalidatePath("/vendors");
  redirect("/vendors");
}
