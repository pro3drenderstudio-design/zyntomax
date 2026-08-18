import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { mobileSession, mobileHasRole } from "@/lib/mobile-auth";

/** Staff directory for HR / operations on mobile. */
export async function GET(request: NextRequest) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!mobileHasRole(session, ["HR_ADMIN", "OPERATIONS_MANAGER"])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const staff = await prisma.staffProfile.findMany({
    include: { user: { include: { roles: true } } },
    orderBy: { staffNo: "asc" },
  });

  return NextResponse.json({
    staff: staff.map((s) => ({
      id: s.id,
      staffNo: s.staffNo,
      name: s.user.name,
      phone: s.user.phone,
      title: s.title,
      wageModel: s.wageModel,
      status: s.user.status,
      roles: [...new Set(s.user.roles.map((r) => r.role))],
    })),
  });
}
