import { NextResponse, type NextRequest } from "next/server";
import { getPublicUrl } from "@/lib/r2";

export const dynamic = "force-dynamic";

/**
 * Stable, on-domain download links for the mobile apps, backed by the APKs
 * mirrored into Cloudflare R2 at a fixed key (see /api/admin/mirror-app). The
 * public URL is permanent even as new builds replace the file at the same key.
 */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ app: string }> }) {
  const { app } = await ctx.params;
  if (app !== "admin" && app !== "vendor") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    return NextResponse.redirect(getPublicUrl(`zyntomax-${app}.apk`), 307);
  } catch {
    return NextResponse.json({ error: "Downloads not configured" }, { status: 500 });
  }
}
