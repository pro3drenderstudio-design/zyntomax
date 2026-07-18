import { notFound } from "next/navigation";
import { prisma } from "@zyntomax/db";
import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { IdCard } from "../id-card";
import { PrintButton } from "./print-button";

export const metadata = { title: "Staff ID card" };

export default async function IdCardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireSession();
  const { id } = await params;

  const staff = await prisma.staffProfile.findUnique({
    where: { id },
    include: { user: { include: { roles: true } } },
  });
  if (!staff) notFound();

  const role = (staff.user.roles[0]?.role ?? "Staff").replace(/_/g, " ");

  return (
    <div>
      <PageHeader
        title="Staff ID card"
        subtitle={`${staff.user.name} · ${staff.staffNo}`}
        action={<PrintButton />}
      />
      <p className="mb-4 text-sm text-muted print:hidden">
        Print at ~86 × 54 mm (CR80 card) or &quot;Save as PDF&quot;. Front and back shown below.
      </p>
      <IdCard
        data={{
          name: staff.user.name,
          staffNo: staff.staffNo,
          role,
          photoUrl: staff.photoUrl,
          hireDate: staff.hireDate,
          phone: staff.user.phone,
          address: staff.address,
          nextOfKin: staff.nextOfKinName
            ? `${staff.nextOfKinName}${staff.nextOfKinPhone ? ` · ${staff.nextOfKinPhone}` : ""}`
            : null,
          bloodContact: staff.emergencyName
            ? `${staff.emergencyName}${staff.emergencyPhone ? ` · ${staff.emergencyPhone}` : ""}`
            : null,
        }}
      />
    </div>
  );
}
