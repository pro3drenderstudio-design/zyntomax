import { jwtVerify, SignJWT } from "jose";
import type { NextRequest } from "next/server";
import type { RoleName } from "@zyntomax/db";
import type { Session, SessionRole } from "./session";

/** Bearer-token auth for the mobile API (same secret and payload as web sessions). */

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function issueMobileToken(session: Session): Promise<string> {
  return new SignJWT(session as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret());
}

export async function mobileSession(request: NextRequest): Promise<Session | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const { payload } = await jwtVerify(header.slice(7), secret());
    return {
      userId: payload.userId as string,
      name: payload.name as string,
      roles: (payload.roles as SessionRole[]) ?? [],
    };
  } catch {
    return null;
  }
}

export function mobileHasRole(session: Session, roles: RoleName[]): boolean {
  return session.roles.some(
    (r) => r.role === "SUPER_ADMIN" || roles.includes(r.role),
  );
}
