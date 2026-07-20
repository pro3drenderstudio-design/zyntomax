import { notFound } from "next/navigation";
import { prisma } from "@zyntomax/db";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { StaffForm } from "../../new/staff-form";

export const metadata = { title: "Edit staff" };

export default async function EditStaffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole(["HR_ADMIN", "OPERATIONS_MANAGER"]);
  const { id } = await params;

  const [staff, sites] = await Promise.all([
    prisma.staffProfile.findUnique({
      where: { id },
      include: { user: { include: { roles: true } } },
    }),
    prisma.site.findMany({ where: { active: true } }),
  ]);
  if (!staff) notFound();

  return (
    <div className="max-w-2xl">
      <PageHeader title={`Edit ${staff.user.name}`} subtitle={staff.staffNo} />
      <StaffForm
        sites={sites.map((s) => ({ id: s.id, name: s.name }))}
        staff={{
          id: staff.id,
          name: staff.user.name,
          title: staff.title,
          phone: staff.user.phone,
          email: staff.user.email,
          photoUrl: staff.photoUrl,
          address: staff.address,
          hireDate: staff.hireDate ? staff.hireDate.toISOString().slice(0, 10) : null,
          bankName: staff.bankName,
          bankAccountNo: staff.bankAccountNo,
          nextOfKinName: staff.nextOfKinName,
          nextOfKinPhone: staff.nextOfKinPhone,
          emergencyName: staff.emergencyName,
          emergencyPhone: staff.emergencyPhone,
          siteId: staff.user.roles[0]?.siteId ?? sites[0]?.id ?? "",
        }}
      />
    </div>
  );
}
