import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { COOKIE_NAME } from "@/lib/session";

// /api/mobile and /api/vendor do their own Bearer-token auth
const PUBLIC_PATHS = ["/login", "/api/webhooks", "/api/mobile", "/api/vendor"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET));
    return NextResponse.next();
  } catch {
    const response = NextResponse.redirect(new URL("/login", request.url));
    response.cookies.delete(COOKIE_NAME);
    return response;
  }
}

export const config = {
  // Exclude Next internals, uploads, and any static asset with a file
  // extension (logo.png, images, etc.) so public files aren't auth-gated.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|uploads|.*\\.[\\w]+$).*)"],
};
