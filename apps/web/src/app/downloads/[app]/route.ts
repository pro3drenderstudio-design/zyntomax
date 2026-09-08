import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL;
const BUCKET = process.env.SUPABASE_UPLOAD_BUCKET ?? "uploads";

/**
 * Stable, on-domain download links for the mobile apps. Backed by the APKs
 * mirrored into Supabase Storage (see /api/admin/mirror-app), so the public
 * URL is permanent even as new builds replace the file at the same key.
 */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ app: string }> }) {
  const { app } = await ctx.params;
  if (app !== "admin" && app !== "vendor") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!SUPABASE_URL) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
  }
  const target = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/downloads/zyntomax-${app}.apk`;
  return NextResponse.redirect(target, 307);
}
