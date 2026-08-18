import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { mobileSession } from "@/lib/mobile-auth";

/** Register the staff member's Expo push token. */
export async function POST(request: NextRequest) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { token } = (await request.json()) as { token?: string };
  if (!token) return NextResponse.json({ error: "No token" }, { status: 400 });
  await prisma.user.update({ where: { id: session.userId }, data: { pushToken: token } });
  return NextResponse.json({ ok: true });
}
