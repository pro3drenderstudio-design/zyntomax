"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, type RoleName } from "@zyntomax/db";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { hashPassword } from "@/lib/password";

export type FormState = { error?: string };

const ROLE_VALUES = [
  "OPERATIONS_MANAGER", "FACTORY_SUPERVISOR", "FINANCE_ADMIN",
  "PURCHASING_MANAGER", "HR_ADMIN", "SALES_ADMIN", "TEAM_LEAD",
  "COLLECTION_AGENT", "PRODUCTION_STAFF", "AUDITOR",
] as const;

const staffSchema = z.object({
  name: z.string().min(2),
  phone: z.string().regex(/^0\d{10}$/, "Enter an 11-digit phone number"),
  email: z.string().email().optional().or(z.literal("")),
  address: z.string().optional(),
  siteId: z.string().min(1),
  hireDate: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNo: z.string().optional(),
  nextOfKinName: z.string().optional(),
  nextOfKinPhone: z.string().optional(),
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
});

async function nextStaffNo(): Promise<string> {
  const count = await prisma.staffProfile.count();
  return `ZYN-${String(count + 1).padStart(4, "0")}`;
}

export async function createStaff(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["HR_ADMIN", "OPERATIONS_MANAGER"]);

  const parsed = staffSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const roles = formData
    .getAll("roles")
    .map(String)
    .filter((r): r is (typeof ROLE_VALUES)[number] =>
      (ROLE_VALUES as readonly string[]).includes(r),
    );
  if (roles.length === 0) return { error: "Pick at least one role." };

  const existing = await prisma.user.findUnique({ where: { phone: data.phone } });
  if (existing) return { error: "A user with this phone number already exists." };

  // First login uses the phone number as password; staff should change it
  const passwordHash = await hashPassword(data.phone);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      phone: data.phone,
      email: data.email || undefined,
      passwordHash,
      roles: {
        create: roles.map((role) => ({ role: role as RoleName, siteId: data.siteId })),
      },
      staffProfile: {
        create: {
          staffNo: await nextStaffNo(),
          address: data.address,
          hireDate: data.hireDate ? new Date(data.hireDate) : new Date(),
          bankName: data.bankName,
          bankAccountNo: data.bankAccountNo,
          nextOfKinName: data.nextOfKinName,
          nextOfKinPhone: data.nextOfKinPhone,
          emergencyName: data.emergencyName,
          emergencyPhone: data.emergencyPhone,
        },
      },
    },
    include: { staffProfile: true },
  });

  await audit({
    actorId: session.userId,
    action: "staff.create",
    entity: "StaffProfile",
    entityId: user.staffProfile!.id,
    after: { name: data.name, roles },
  });

  revalidatePath("/staff");
  redirect(`/staff/${user.staffProfile!.id}`);
}

// ── Issuances, logs, advances ───────────────────────────────────────────

export async function addIssuance(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["HR_ADMIN", "OPERATIONS_MANAGER"]);
  const staffId = String(formData.get("staffId") ?? "");
  const item = String(formData.get("item") ?? "").trim();
  const quantity = Number(formData.get("quantity") ?? 1);
  const condition = String(formData.get("condition") ?? "new");
  if (!staffId || !item) return { error: "Item is required." };

  await prisma.issuance.create({
    data: { staffId, item, quantity, condition, issuedById: session.userId },
  });
  revalidatePath(`/staff/${staffId}`);
  revalidatePath("/issuances");
  return {};
}

export async function addStaffLog(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["HR_ADMIN", "OPERATIONS_MANAGER"]);
  const staffId = String(formData.get("staffId") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const cost = formData.get("cost") ? Number(formData.get("cost")) : undefined;
  if (!staffId || !description || !["MEDICAL", "REWARD", "DISCIPLINARY"].includes(kind)) {
    return { error: "Description and type are required." };
  }

  await prisma.staffLog.create({
    data: {
      staffId,
      kind: kind as "MEDICAL" | "REWARD" | "DISCIPLINARY",
      description,
      cost,
      loggedById: session.userId,
    },
  });
  revalidatePath(`/staff/${staffId}`);
  revalidatePath("/issuances");
  return {};
}

export async function addAdvance(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["FINANCE_ADMIN", "HR_ADMIN"]);
  const staffId = String(formData.get("staffId") ?? "");
  const amount = Number(formData.get("amount"));
  const cap = formData.get("weeklyDeductionCap")
    ? Number(formData.get("weeklyDeductionCap"))
    : undefined;
  const note = String(formData.get("note") ?? "").trim() || undefined;
  if (!staffId || !amount || amount <= 0) return { error: "Enter a valid amount." };

  const advance = await prisma.salaryAdvance.create({
    data: { staffId, amount, weeklyDeductionCap: cap, note, grantedById: session.userId },
  });
  await audit({
    actorId: session.userId,
    action: "advance.grant",
    entity: "SalaryAdvance",
    entityId: advance.id,
    after: { staffId, amount },
  });
  revalidatePath(`/staff/${staffId}`);
  revalidatePath("/issuances");
  return {};
}
