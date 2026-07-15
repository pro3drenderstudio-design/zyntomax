import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { verifyPassword } from "@/lib/password";
import { issueMobileToken } from "@/lib/mobile-auth";

export async function POST(request: NextRequest) {
  const { phone, password } = (await request.json()) as {
    phone?: string;
    password?: string;
  };
  if (!phone || !password) {
    return NextResponse.json({ error: "Phone and password required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { phone },
    include: { roles: true, staffProfile: true },
  });
  if (!user?.passwordHash || user.status !== "ACTIVE") {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
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
