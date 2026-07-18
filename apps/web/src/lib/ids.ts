import { prisma } from "@zyntomax/db";

/** Human-friendly sequential IDs. Count-based; fine at this scale. */

export async function nextVendorNo(): Promise<string> {
  const count = await prisma.vendor.count();
  return `ZYN-V-${String(count + 1).padStart(4, "0")}`;
}

export async function nextStaffNo(): Promise<string> {
  const count = await prisma.staffProfile.count();
  return `ZYN-${String(count + 1).padStart(4, "0")}`;
}
