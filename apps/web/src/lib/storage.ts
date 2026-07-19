import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

/**
 * File storage. In production (when Supabase env vars are set) it uploads to a
 * Supabase Storage bucket and returns the public object URL. In local dev it
 * falls back to writing under apps/web/public/uploads. Callers only depend on
 * saveUpload() returning a URL string.
 */

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 6 * 1024 * 1024;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_UPLOAD_BUCKET ?? "uploads";

function extFor(type: string) {
  return type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
}

export async function saveUpload(file: File): Promise<string> {
  if (!ALLOWED.has(file.type)) {
    throw new Error("Only JPG, PNG or WebP images are allowed.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Image must be under 6MB.");
  }
  const name = `${randomUUID()}.${extFor(file.type)}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  // Production: Supabase Storage (persistent across deploys / serverless).
  if (SUPABASE_URL && SERVICE_KEY) {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${name}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": file.type,
        "cache-control": "3600",
        "x-upsert": "true",
      },
      body: bytes,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`Upload failed (${res.status}). ${detail.slice(0, 200)}`);
    }
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${name}`;
  }

  // Dev fallback: write to public/uploads and return a relative path.
  const uploadDir = join(process.cwd(), "public", "uploads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(join(uploadDir, name), bytes);
  return `/uploads/${name}`;
}
