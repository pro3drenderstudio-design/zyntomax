import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Stable, on-domain download links for the mobile apps. The actual file URL is
 * held in an env var so the backing host can change (EAS artifact today, a
 * durable store once configured) without touching the public link.
 */
export async function GET(_request: NextRequest, ctx: { params: Promise<{ app: string }> }) {
  const { app } = await ctx.params;
  const target =
    app === "vendor" ? process.env.VENDOR_APK_URL
    : app === "admin" ? process.env.ZYNTOMAX_ADMIN_APK_URL
    : null;
  if (target === null) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!target) return NextResponse.json({ error: "Download not available yet" }, { status: 503 });
  return NextResponse.redirect(target, 307);
}
