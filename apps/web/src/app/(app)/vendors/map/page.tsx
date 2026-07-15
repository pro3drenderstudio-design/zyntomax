import { prisma } from "@zyntomax/db";
import { requireSession, accessibleSiteIds } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { VendorMap } from "./vendor-map";

export const metadata = { title: "Vendor map" };

export default async function VendorMapPage() {
  const session = await requireSession();
  const siteIds = accessibleSiteIds(session);

  const vendors = await prisma.vendor.findMany({
    where: {
      lat: { not: null },
      lng: { not: null },
      status: "ACTIVE",
      ...(siteIds ? { siteId: { in: siteIds } } : {}),
    },
    include: { locality: true, weighIns: { select: { weightKg: true } } },
  });

  const pins = vendors.map((v) => ({
    id: v.id,
    name: v.name,
    lat: v.lat!,
    lng: v.lng!,
    locality: v.locality?.name ?? null,
    lifetimeKg: v.weighIns.reduce((s, w) => s + Number(w.weightKg), 0),
  }));

  return (
    <div>
      <PageHeader
        title="Vendor map"
        subtitle={`${pins.length} vendors with pinned locations — clusters show density per area`}
      />
      <VendorMap pins={pins} />
    </div>
  );
}
