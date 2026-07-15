import Link from "next/link";
import { prisma } from "@zyntomax/db";
import { requireSession } from "@/lib/auth";
import { PageHeader, Table, Badge, formatNaira } from "@/components/ui";

const LOG_TONE = { MEDICAL: "info", REWARD: "success", DISCIPLINARY: "destructive" } as const;

export default async function IssuancesPage() {
  await requireSession();

  const [issuances, logs, advances] = await Promise.all([
    prisma.issuance.findMany({
      include: { staff: { include: { user: true } } },
      orderBy: { issuedAt: "desc" },
      take: 50,
    }),
    prisma.staffLog.findMany({
      include: { staff: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.salaryAdvance.findMany({
      include: { staff: { include: { user: true } } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="PPE, logs & advances"
        subtitle="Company-wide view — add entries from each staff member's profile"
      />

      <h2 className="mb-2 font-medium">Recent PPE & equipment issues</h2>
      <Table headers={["Date", "Staff", "Item", "Qty", "Condition"]}>
        {issuances.map((i) => (
          <tr key={i.id}>
            <td className="px-3 py-2">{i.issuedAt.toLocaleDateString("en-NG")}</td>
            <td className="px-3 py-2">
              <Link href={`/staff/${i.staffId}`} className="hover:underline">{i.staff.user.name}</Link>
            </td>
            <td className="px-3 py-2">{i.item}</td>
            <td className="tabular px-3 py-2">{i.quantity}</td>
            <td className="px-3 py-2">{i.condition ?? "—"}</td>
          </tr>
        ))}
      </Table>

      <h2 className="mb-2 mt-6 font-medium">Medical / rewards / disciplinary</h2>
      <Table headers={["Date", "Staff", "Type", "Description", "Cost"]}>
        {logs.map((l) => (
          <tr key={l.id}>
            <td className="px-3 py-2">{l.createdAt.toLocaleDateString("en-NG")}</td>
            <td className="px-3 py-2">
              <Link href={`/staff/${l.staffId}`} className="hover:underline">{l.staff.user.name}</Link>
            </td>
            <td className="px-3 py-2"><Badge tone={LOG_TONE[l.kind]}>{l.kind}</Badge></td>
            <td className="px-3 py-2">{l.description}</td>
            <td className="tabular px-3 py-2">{l.cost ? formatNaira(Number(l.cost)) : "—"}</td>
          </tr>
        ))}
      </Table>

      <h2 className="mb-2 mt-6 font-medium">Salary advances</h2>
      <Table headers={["Date", "Staff", "Amount", "Repaid", "Outstanding"]}>
        {advances.map((a) => (
          <tr key={a.id}>
            <td className="px-3 py-2">{a.createdAt.toLocaleDateString("en-NG")}</td>
            <td className="px-3 py-2">
              <Link href={`/staff/${a.staffId}`} className="hover:underline">{a.staff.user.name}</Link>
            </td>
            <td className="tabular px-3 py-2">{formatNaira(Number(a.amount))}</td>
            <td className="tabular px-3 py-2">{formatNaira(Number(a.repaidAmount))}</td>
            <td className="tabular px-3 py-2 font-medium">
              {formatNaira(Number(a.amount) - Number(a.repaidAmount))}
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
