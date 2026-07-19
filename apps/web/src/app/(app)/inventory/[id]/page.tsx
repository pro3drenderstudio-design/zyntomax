import { notFound } from "next/navigation";
import { prisma } from "@zyntomax/db";
import { requireSession, accessibleSiteIds } from "@/lib/auth";
import { materialHistory } from "@/lib/inventory";
import { PageHeader, Card, Badge, Table, formatKg } from "@/components/ui";

const KIND_LABEL: Record<string, string> = { RAW: "Raw material", INTERMEDIATE: "Intermediate (in processing)", FINISHED: "Finished good" };
const KIND_TONE = { RAW: "neutral", INTERMEDIATE: "info", FINISHED: "success" } as const;

export default async function MaterialHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const siteIds = accessibleSiteIds(session);
  const { id } = await params;

  const material = await prisma.materialType.findUnique({ where: { id } });
  if (!material) notFound();

  const history = await materialHistory(id, siteIds);

  return (
    <div>
      <PageHeader
        title={material.name}
        subtitle="Processing history — how this material moved between stages, stores and people"
        action={<Badge tone={KIND_TONE[material.kind]}>{KIND_LABEL[material.kind]}</Badge>}
      />

      {history.length === 0 ? (
        <Card><p className="py-6 text-center text-sm text-muted">No movement history for this material yet.</p></Card>
      ) : (
        <Table headers={["When", "Weight", "From", "To", "By", "Detail"]}>
          {history.map((h, i) => (
            <tr key={i}>
              <td className="px-3 py-2">{h.createdAt.toLocaleString("en-NG", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
              <td className="tabular px-3 py-2 font-medium">{formatKg(h.weightKg)}</td>
              <td className="px-3 py-2 text-muted">{h.from ?? "— (external)"}</td>
              <td className="px-3 py-2 text-muted">{h.to ?? "— (external)"}</td>
              <td className="px-3 py-2">{h.by ?? "—"}</td>
              <td className="px-3 py-2 text-muted">{h.note ?? h.refType}</td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
