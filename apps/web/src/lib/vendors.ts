import { prisma } from "@zyntomax/db";
import { audit } from "@/lib/audit";
import { createTransferRecipient, resolveAccount } from "@/lib/paystack";
import { nextVendorNo } from "@/lib/ids";
import { sendSms } from "@/lib/sms";
import { sendExpoPush } from "@/lib/push";

/** Resolve + create a Paystack transfer recipient for a bank account. */
export async function verifyBank(bankAccountNo?: string, bankCode?: string) {
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

/** Approve a self-registered (PENDING) vendor. Audits + notifies internally. */
export async function approveVendorById(vendorId: string, actorId: string): Promise<{ ok: boolean; error?: string }> {
  const v = await prisma.vendor.findUniqueOrThrow({ where: { id: vendorId } });
  if (v.status !== "PENDING") return { ok: false, error: "Vendor is not pending approval." };
  await prisma.vendor.update({
    where: { id: vendorId },
    data: { status: "ACTIVE", vendorNo: v.vendorNo ?? (await nextVendorNo()) },
  });
  await sendSms({ to: v.phone, vendorId, body: "Zyntomax: your account has been approved! Open the app and sign in to start recycling." });
  await sendExpoPush(v.pushToken, "Account approved ✅", "You can now sign in and start requesting pickups.");
  await audit({ actorId, action: "vendor.approve", entity: "Vendor", entityId: vendorId });
  return { ok: true };
}

/** Reject (delete) a self-registered (PENDING) vendor. */
export async function rejectVendorById(vendorId: string, actorId: string): Promise<{ ok: boolean; error?: string }> {
  const v = await prisma.vendor.findUniqueOrThrow({ where: { id: vendorId } });
  if (v.status !== "PENDING") return { ok: false, error: "Only pending vendors can be rejected." };
  await prisma.vendor.delete({ where: { id: vendorId } });
  await audit({ actorId, action: "vendor.reject", entity: "Vendor", entityId: vendorId, before: { name: v.name, phone: v.phone } });
  return { ok: true };
}

/** Activate / deactivate / blacklist a vendor. */
export async function setVendorStatusById(
  vendorId: string,
  status: "ACTIVE" | "INACTIVE" | "BLACKLISTED",
  actorId: string,
): Promise<void> {
  const before = await prisma.vendor.findUniqueOrThrow({ where: { id: vendorId } });
  await prisma.vendor.update({ where: { id: vendorId }, data: { status } });
  await audit({ actorId, action: "vendor.status", entity: "Vendor", entityId: vendorId, before: { status: before.status }, after: { status } });
}

/**
 * Delete a vendor. One with collection history is blacklisted instead of
 * hard-deleted (deleting would orphan ledger/payout records). Returns whether
 * it was a soft delete.
 */
export async function deleteVendorById(vendorId: string, actorId: string): Promise<{ softDeleted: boolean }> {
  const weighIns = await prisma.collectionWeighIn.count({ where: { vendorId } });
  if (weighIns > 0) {
    await prisma.vendor.update({ where: { id: vendorId }, data: { status: "BLACKLISTED" } });
    await audit({ actorId, action: "vendor.soft_delete", entity: "Vendor", entityId: vendorId });
    return { softDeleted: true };
  }
  await prisma.pickupRequest.deleteMany({ where: { vendorId } });
  await prisma.vendor.delete({ where: { id: vendorId } });
  await audit({ actorId, action: "vendor.delete", entity: "Vendor", entityId: vendorId });
  return { softDeleted: false };
}
