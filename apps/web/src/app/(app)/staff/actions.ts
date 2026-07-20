"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma, type RoleName } from "@zyntomax/db";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { hashPassword } from "@/lib/password";
import { nextStaffNo } from "@/lib/ids";

export type FormState = { error?: string };

const ROLE_VALUES = [
  "OPERATIONS_MANAGER", "FACTORY_SUPERVISOR", "FINANCE_ADMIN",
  "PURCHASING_MANAGER", "HR_ADMIN", "SALES_ADMIN", "TEAM_LEAD",
  "COLLECTION_AGENT", "PRODUCTION_STAFF", "AUDITOR",
] as const;

const staffSchema = z.object({
  name: z.string().min(2),
  title: z.string().optional(),
  phone: z.string().regex(/^0\d{10}$/, "Enter an 11-digit phone number"),
  email: z.string().email().optional().or(z.literal("")),
  photoUrl: z.string().optional(),
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
          title: data.title || null,
          photoUrl: data.photoUrl,
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

export async function updateStaff(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["HR_ADMIN", "OPERATIONS_MANAGER"]);
  const staffId = String(formData.get("staffId") ?? "");
  const parsed = staffSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const staff = await prisma.staffProfile.findUniqueOrThrow({
    where: { id: staffId },
    include: { user: true },
  });

  if (data.phone !== staff.user.phone) {
    const clash = await prisma.user.findUnique({ where: { phone: data.phone } });
    if (clash) return { error: "Another user already uses this phone number." };
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: staff.userId },
      data: { name: data.name, phone: data.phone, email: data.email || null },
    }),
    prisma.staffProfile.update({
      where: { id: staffId },
      data: {
        title: data.title || null,
        photoUrl: data.photoUrl ?? null,
        address: data.address ?? null,
        hireDate: data.hireDate ? new Date(data.hireDate) : staff.hireDate,
        bankName: data.bankName ?? null,
        bankAccountNo: data.bankAccountNo ?? null,
        nextOfKinName: data.nextOfKinName ?? null,
        nextOfKinPhone: data.nextOfKinPhone ?? null,
        emergencyName: data.emergencyName ?? null,
        emergencyPhone: data.emergencyPhone ?? null,
      },
    }),
  ]);

  await audit({
    actorId: session.userId,
    action: "staff.update",
    entity: "StaffProfile",
    entityId: staffId,
    after: { name: data.name },
  });
  revalidatePath(`/staff/${staffId}`);
  revalidatePath("/staff");
  redirect(`/staff/${staffId}`);
}

export async function setStaffStatus(
  staffId: string,
  status: "ACTIVE" | "SUSPENDED" | "EXITED",
) {
  const session = await requireRole(["HR_ADMIN", "OPERATIONS_MANAGER"]);
  const staff = await prisma.staffProfile.findUniqueOrThrow({ where: { id: staffId } });
  await prisma.user.update({ where: { id: staff.userId }, data: { status } });
  await audit({
    actorId: session.userId,
    action: "staff.status",
    entity: "StaffProfile",
    entityId: staffId,
    after: { status },
  });
  revalidatePath(`/staff/${staffId}`);
  revalidatePath("/staff");
}

export async function deleteStaff(staffId: string) {
  const session = await requireRole(["HR_ADMIN", "OPERATIONS_MANAGER"]);
  const staff = await prisma.staffProfile.findUniqueOrThrow({ where: { id: staffId } });

  // Never hard-delete staff with work/payroll history — mark EXITED so wages,
  // jobs and audit trail remain intact.
  const [jobs, payroll] = await Promise.all([
    prisma.jobAssignment.count({ where: { staffId } }),
    prisma.payrollItem.count({ where: { staffId } }),
  ]);
  if (jobs > 0 || payroll > 0) {
    await prisma.user.update({ where: { id: staff.userId }, data: { status: "EXITED" } });
    await audit({
      actorId: session.userId,
      action: "staff.soft_delete",
      entity: "StaffProfile",
      entityId: staffId,
    });
    revalidatePath("/staff");
    redirect("/staff");
  }

  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId: staff.userId } }),
    prisma.staffProfile.delete({ where: { id: staffId } }),
    prisma.user.delete({ where: { id: staff.userId } }),
  ]);
  await audit({
    actorId: session.userId,
    action: "staff.delete",
    entity: "StaffProfile",
    entityId: staffId,
  });
  revalidatePath("/staff");
  redirect("/staff");
}

/** Super Admin only: set the full role list for a staff member (promote/demote). */
export async function updateStaffRoles(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole([]); // SUPER_ADMIN only
  const staffId = String(formData.get("staffId") ?? "");
  const siteId = String(formData.get("siteId") ?? "");
  const roles = formData
    .getAll("roles")
    .map(String)
    .filter((r): r is (typeof ROLE_VALUES)[number] =>
      (ROLE_VALUES as readonly string[]).includes(r),
    );
  if (roles.length === 0) return { error: "A staff member needs at least one role." };

  const staff = await prisma.staffProfile.findUniqueOrThrow({ where: { id: staffId } });

  await prisma.$transaction([
    // Preserve any SUPER_ADMIN grant; replace the rest
    prisma.userRole.deleteMany({
      where: { userId: staff.userId, role: { not: "SUPER_ADMIN" } },
    }),
    prisma.userRole.createMany({
      data: roles.map((role) => ({ userId: staff.userId, role: role as RoleName, siteId })),
      skipDuplicates: true,
    }),
  ]);

  await audit({
    actorId: session.userId,
    action: "staff.roles",
    entity: "StaffProfile",
    entityId: staffId,
    after: { roles },
  });
  revalidatePath(`/staff/${staffId}`);
  return {};
}

export async function changeStaffPassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireRole(["HR_ADMIN", "OPERATIONS_MANAGER"]);
  const staffId = String(formData.get("staffId") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < 6) return { error: "Password must be at least 6 characters." };

  const staff = await prisma.staffProfile.findUniqueOrThrow({ where: { id: staffId } });
  await prisma.user.update({
    where: { id: staff.userId },
    data: { passwordHash: await hashPassword(password) },
  });
  await audit({
    actorId: session.userId,
    action: "staff.password_reset",
    entity: "StaffProfile",
    entityId: staffId,
  });
  return {};
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
