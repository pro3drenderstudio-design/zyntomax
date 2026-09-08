import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
// Dedicated public bucket with no MIME restriction (the image uploads bucket
// only allows image/* and rejects APKs).
const BUCKET = "app-downloads";

async function ensureBucket() {
  // Idempotent: create the public bucket if it doesn't exist yet.
  await fetch(`${SUPABASE_URL}/storage/v1/bucket`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: true }),
  }).catch(() => {});
}

/**
 * Copy a built APK into Supabase Storage at a stable key so the public download
 * links never expire (EAS artifact URLs are garbage-collected after ~30 days).
 * One-off, secret-gated operational tool: pass ?app=admin|vendor&src=<apk url>
 * with the x-mirror-secret header. Serves the result from /downloads/<app>.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.MIRROR_SECRET;
  if (!secret || request.headers.get("x-mirror-secret") !== secret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
  }

  const app = request.nextUrl.searchParams.get("app");
  const src = request.nextUrl.searchParams.get("src");
  if (app !== "admin" && app !== "vendor") return NextResponse.json({ error: "app must be admin|vendor" }, { status: 400 });
  if (!src || !/^https:\/\//.test(src)) return NextResponse.json({ error: "src (https URL) required" }, { status: 400 });

  const srcRes = await fetch(src, { redirect: "follow" });
  if (!srcRes.ok) return NextResponse.json({ error: `Source fetch failed (${srcRes.status})` }, { status: 502 });
  const bytes = Buffer.from(await srcRes.arrayBuffer());

  await ensureBucket();
  const key = `zyntomax-${app}.apk`;
  const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/vnd.android.package-archive",
      "cache-control": "3600",
      "x-upsert": "true",
    },
    body: bytes,
  });
  if (!up.ok) {
    const detail = await up.text().catch(() => "");
    return NextResponse.json({ error: `Upload failed (${up.status}) ${detail.slice(0, 200)}` }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    app,
    bytes: bytes.length,
    publicUrl: `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${key}`,
    downloadPath: `/downloads/${app}`,
  });
}
