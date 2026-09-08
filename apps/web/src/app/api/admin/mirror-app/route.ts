import { NextResponse, type NextRequest } from "next/server";
import { uploadToR2 } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Copy a built APK into Cloudflare R2 at a stable key so the public download
 * links never expire (EAS artifact URLs are garbage-collected quickly).
 * One-off, secret-gated operational tool: POST ?app=admin|vendor&src=<apk url>
 * with the x-mirror-secret header. Served from /downloads/<app>.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.MIRROR_SECRET;
  if (!secret || request.headers.get("x-mirror-secret") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const app = request.nextUrl.searchParams.get("app");
  const src = request.nextUrl.searchParams.get("src");
  if (app !== "admin" && app !== "vendor") return NextResponse.json({ error: "app must be admin|vendor" }, { status: 400 });
  if (!src || !/^https:\/\//.test(src)) return NextResponse.json({ error: "src (https URL) required" }, { status: 400 });

  const srcRes = await fetch(src, { redirect: "follow" });
  if (!srcRes.ok) return NextResponse.json({ error: `Source fetch failed (${srcRes.status})` }, { status: 502 });
  const bytes = Buffer.from(await srcRes.arrayBuffer());

  const key = `zyntomax-${app}.apk`;
  try {
    const publicUrl = await uploadToR2(key, bytes, "application/vnd.android.package-archive");
    return NextResponse.json({ ok: true, app, bytes: bytes.length, publicUrl, downloadPath: `/downloads/${app}` });
  } catch (e) {
    return NextResponse.json({ error: `R2 upload failed: ${e instanceof Error ? e.message : "unknown"}` }, { status: 502 });
  }
}
