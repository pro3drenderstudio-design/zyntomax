import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { mobileSession, mobileHasRole } from "@/lib/mobile-auth";
import { completeProductionJob } from "@/lib/production";

/** Scale-out: record outputs + waste, transform inventory (or flag if out of tolerance). */
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const isSupervisor = mobileHasRole(session, ["FACTORY_SUPERVISOR", "OPERATIONS_MANAGER"]);
  if (!isSupervisor) {
    // Production staff may only scale out jobs they're assigned to.
    const staff = await prisma.staffProfile.findUnique({ where: { userId: session.userId } });
    const assigned = staff && (await prisma.jobAssignment.findFirst({ where: { jobId: id, staffId: staff.id } }));
    if (!assigned) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { outputs?: { outputMaterialTypeId: string; weightKg: number }[]; wasteKg?: number; scaleOutPhotoUrl?: string };

  const res = await completeProductionJob({
    jobId: id,
    outputs: body.outputs ?? [],
    wasteKg: Number(body.wasteKg ?? 0),
    scaleOutPhotoUrl: body.scaleOutPhotoUrl,
    actorId: session.userId,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 422 });
  return NextResponse.json({ status: res.status });
}
