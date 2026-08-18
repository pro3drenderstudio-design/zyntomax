import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { mobileSession, issueMobileToken } from "@/lib/mobile-auth";

/**
 * Refresh the signed-in user's roles and re-mint their token. The app calls
 * this on launch / when opening the Manage tab so role changes (and account
 * suspension) take effect without a manual sign-out — the login snapshot alone
 * would otherwise leave the token's roles stale for up to its 30-day life.
 */
export async function GET(request: NextRequest) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { roles: true, staffProfile: true },
  });
  if (!user || user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Account inactive" }, { status: 401 });
  }

  const token = await issueMobileToken({
    userId: user.id,
    name: user.name,
    roles: user.roles.map((r) => ({ role: r.role, siteId: r.siteId })),
  });

  return NextResponse.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      staffId: user.staffProfile?.id ?? null,
      staffNo: user.staffProfile?.staffNo ?? null,
      roles: user.roles.map((r) => r.role),
    },
  });
}
