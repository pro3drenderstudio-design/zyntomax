import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import type { RoleName } from "@zyntomax/db";
import { mobileSession, mobileHasRole } from "@/lib/mobile-auth";
import { createProductionJob } from "@/lib/production";

const SUPERVISOR: RoleName[] = ["FACTORY_SUPERVISOR", "OPERATIONS_MANAGER"];

/** Jobs to work: assigned to me (production staff) or all open jobs (supervisor). */
export async function GET(request: NextRequest) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const isSupervisor = mobileHasRole(session, SUPERVISOR);
  const staff = await prisma.staffProfile.findUnique({ where: { userId: session.userId } });

  const where = isSupervisor
    ? { status: { in: ["ASSIGNED", "IN_PROGRESS", "FLAGGED"] as never } }
    : { status: { in: ["ASSIGNED", "IN_PROGRESS", "FLAGGED"] as never }, assignments: { some: { staffId: staff?.id ?? "__none__" } } };

  const jobs = await prisma.job.findMany({
    where,
    include: { stage: true, materialType: true, assignments: { include: { staff: { include: { user: true } } } } },
    orderBy: { startedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    isSupervisor,
    jobs: jobs.map((j) => ({
      id: j.id,
      stage: j.stage.name,
      inputMaterial: j.materialType.name,
      weightInKg: Number(j.weightInKg),
      weightOutKg: j.weightOutKg === null ? null : Number(j.weightOutKg),
      status: j.status,
      flagReason: j.flagReason,
      startedAt: j.startedAt,
      assignees: j.assignments.map((a) => a.staff.user.name),
    })),
  });
}

/** Scale-in: create a job for the actor at a stage from available input material. */
export async function POST(request: NextRequest) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mobileHasRole(session, [...SUPERVISOR, "PRODUCTION_STAFF" as RoleName])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as { siteId?: string; stageId?: string; materialTypeId?: string; weightInKg?: number; scaleInPhotoUrl?: string; staffIds?: string[] };
  const staff = await prisma.staffProfile.findUnique({ where: { userId: session.userId } });
  const staffIds = body.staffIds && body.staffIds.length > 0 ? body.staffIds : staff ? [staff.id] : [];
  if (!body.siteId || !body.stageId || !body.materialTypeId || !body.weightInKg) {
    return NextResponse.json({ error: "Missing job details." }, { status: 422 });
  }

  const res = await createProductionJob({
    siteId: body.siteId, stageId: body.stageId, materialTypeId: body.materialTypeId,
    weightInKg: body.weightInKg, staffIds, scaleInPhotoUrl: body.scaleInPhotoUrl, actorId: session.userId,
  });
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 422 });
  return NextResponse.json({ id: res.jobId });
}
