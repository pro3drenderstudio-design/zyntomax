import { NextResponse, type NextRequest } from "next/server";
import { mobileSession } from "@/lib/mobile-auth";
import { saveUpload } from "@/lib/storage";

/** Staff-authed image upload (weigh-in photos, factory scale readings, signatures). */
export async function POST(request: NextRequest) {
  const session = await mobileSession(request);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }
  try {
    const url = await saveUpload(file);
    return NextResponse.json({ url });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Upload failed" },
      { status: 400 },
    );
  }
}
