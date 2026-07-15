import Link from "next/link";
import { prisma } from "@zyntomax/db";
import { requireSession } from "@/lib/auth";
import {
  PageHeader, Table, Badge, statusTone, PrimaryLink,
} from "@/components/ui";
import { UserPlus } from "lucide-react";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  OPERATIONS_MANAGER: "Operations",
  FACTORY_SUPERVISOR: "Supervisor",
  FINANCE_ADMIN: "Finance",
  PURCHASING_MANAGER: "Purchasing",
  HR_ADMIN: "HR",
  SALES_ADMIN: "Sales",
  TEAM_LEAD: "Team Lead",
  COLLECTION_AGENT: "Collection",
  PRODUCTION_STAFF: "Production",
  AUDITOR: "Auditor",
};

export default async function StaffPage() {
  await requireSession();

  const staff = await prisma.staffProfile.findMany({
    include: { user: { include: { roles: true } } },
    orderBy: { staffNo: "asc" },
  });

  return (
    <div>
      <PageHeader
        title="Staff"
        subtitle={`${staff.length} registered staff members`}
        action={
          <PrimaryLink href="/staff/new">
            <UserPlus size={15} aria-hidden /> Register staff
          </PrimaryLink>
        }
      />

      <Table headers={["Staff no", "Name", "Phone", "Roles", "Hired", "Status"]}>
        {staff.map((s) => (
          <tr key={s.id} className="hover:bg-muted-bg">
            <td className="tabular px-3 py-2">
              <Link href={`/staff/${s.id}`} className="font-medium hover:underline">
                {s.staffNo}
              </Link>
            </td>
            <td className="px-3 py-2">{s.user.name}</td>
            <td className="tabular px-3 py-2">{s.user.phone}</td>
            <td className="px-3 py-2">
              <span className="flex flex-wrap gap-1">
                {s.user.roles.map((r) => (
                  <Badge key={r.id} tone="neutral">
                    {ROLE_LABEL[r.role] ?? r.role}
                  </Badge>
                ))}
              </span>
            </td>
            <td className="px-3 py-2">
              {s.hireDate ? s.hireDate.toLocaleDateString("en-NG") : "—"}
            </td>
            <td className="px-3 py-2">
              <Badge tone={statusTone(s.user.status)}>{s.user.status}</Badge>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
