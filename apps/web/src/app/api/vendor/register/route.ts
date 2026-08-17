import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@zyntomax/db";
import { saveUpload } from "@/lib/storage";

/** Self-registration — creates a PENDING vendor awaiting admin approval. No auth. Accepts multipart (photo + fields). */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const address = String(form.get("address") ?? "").trim();
  const latRaw = form.get("lat");
  const lngRaw = form.get("lng");
  const referredByRaw = String(form.get("referredByCode") ?? "").trim().toUpperCase();
  const file = form.get("photo");

  if (name.length < 2) return NextResponse.json({ error: "Enter your full name." }, { status: 422 });
  if (!/^0\d{10}$/.test(phone)) return NextResponse.json({ error: "Enter a valid 11-digit phone number." }, { status: 422 });

  const existing = await prisma.vendor.findUnique({ where: { phone } });
  if (existing) {
    return NextResponse.json({ error: "A vendor with this phone number already exists. Try signing in." }, { status: 409 });
  }

  const site = await prisma.site.findFirst({ where: { active: true }, orderBy: { createdAt: "asc" } });
  if (!site) return NextResponse.json({ error: "Registration is temporarily unavailable." }, { status: 503 });

  let photoUrl: string | null = null;
  if (file instanceof File) {
    try { photoUrl = await saveUpload(file); } catch { /* photo optional if upload fails */ }
  }

  let referredByCode: string | null = null;
  if (referredByRaw) {
    const ref = await prisma.vendor.findUnique({ where: { referralCode: referredByRaw } });
    if (ref) referredByCode = ref.referralCode;
  }

  await prisma.vendor.create({
    data: {
      siteId: site.id,
      name,
      phone,
      photoUrl,
      address: address || null,
      lat: latRaw ? Number(latRaw) : null,
      lng: lngRaw ? Number(lngRaw) : null,
      referredByCode,
      status: "PENDING",
    },
  });

  return NextResponse.json({ ok: true });
}
