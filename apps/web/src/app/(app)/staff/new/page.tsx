import { prisma } from "@zyntomax/db";
import { requireRole } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { StaffForm } from "./staff-form";

export const metadata = { title: "Register staff" };

export default async function NewStaffPage() {
  await requireRole(["HR_ADMIN", "OPERATIONS_MANAGER"]);
  const sites = await prisma.site.findMany({ where: { active: true } });

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Register staff member"
        subtitle="First login password is the staff member's phone number."
      />
      <StaffForm sites={sites.map((s) => ({ id: s.id, name: s.name }))} />
    </div>
  );
}
