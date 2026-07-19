import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";

/** Vendor JWT (audience "vendor") — separate from staff sessions. */

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function issueVendorToken(vendorId: string): Promise<string> {
  return new SignJWT({ vendorId, aud: "vendor" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("60d")
    .sign(secret());
}

export async function vendorFromRequest(request: NextRequest): Promise<string | null> {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  try {
    const { payload } = await jwtVerify(header.slice(7), secret());
    if (payload.aud !== "vendor") return null;
    return (payload.vendorId as string) ?? null;
  } catch {
    return null;
  }
}
