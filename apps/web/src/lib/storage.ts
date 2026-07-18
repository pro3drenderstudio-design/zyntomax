import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

/**
 * File storage. In dev, saves to apps/web/public/uploads and returns a
 * public path. Swap this module for S3/R2 (put + signed URL) in production;
 * callers only depend on saveUpload() returning a URL string.
 */

const UPLOAD_DIR = join(process.cwd(), "public", "uploads");

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 6 * 1024 * 1024;

export async function saveUpload(file: File): Promise<string> {
  if (!ALLOWED.has(file.type)) {
    throw new Error("Only JPG, PNG or WebP images are allowed.");
  }
  if (file.size > MAX_BYTES) {
    throw new Error("Image must be under 6MB.");
  }
  await mkdir(UPLOAD_DIR, { recursive: true });
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const name = `${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(join(UPLOAD_DIR, name), bytes);
  return `/uploads/${name}`;
}
