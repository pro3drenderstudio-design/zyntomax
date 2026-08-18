import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { mobileSession, mobileHasRole } from "@/lib/mobile-auth";
import { recordWeighIn } from "@/lib/collection";

const weighInSchema = z.object({
  clientUuid: z.string().min(8),
  tripId: z.string().min(1),
  vendorId: z.string().min(1),
  materialTypeId: z.string().min(1),
  weightKg: z.number().positive(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  photoUrl: z.string().optional().nullable(),
  signatureUrl: z.string().optional().nullable(),
});

/** Offline-queue sync target — idempotent on clientUuid. */
export async function POST(request: NextRequest) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mobileHasRole(session, ["COLLECTION_AGENT", "TEAM_LEAD", "OPERATIONS_MANAGER"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = weighInSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const result = await recordWeighIn({
    ...parsed.data,
    lat: parsed.data.lat ?? undefined,
    lng: parsed.data.lng ?? undefined,
    photoUrl: parsed.data.photoUrl ?? undefined,
    signatureUrl: parsed.data.signatureUrl ?? undefined,
    agentId: session.userId,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 });
  }
  return NextResponse.json({
    id: result.id,
    amount: result.amount,
    deduped: result.deduped,
  });
}
