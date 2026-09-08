/**
 * Cloudflare R2 client (S3-compatible). Ported from proplan-v2; reuses the same
 * R2 credentials. Large files (>10MB, e.g. APKs) go through a server-side
 * multipart upload so no single request has to move the whole object at once.
 */

import {
  S3Client, PutObjectCommand,
  CreateMultipartUploadCommand, UploadPartCommand,
  CompleteMultipartUploadCommand, AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";

function getClient() {
  const accountId = process.env.R2_ACCOUNT_ID;
  if (!accountId) throw new Error("R2_ACCOUNT_ID env var is not set");
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
    forcePathStyle: false,
  });
}

const BUCKET = () => {
  const b = process.env.R2_BUCKET_NAME;
  if (!b) throw new Error("R2_BUCKET_NAME env var is not set");
  return b;
};

const PUBLIC = () => {
  const u = process.env.R2_PUBLIC_URL;
  if (!u) throw new Error("R2_PUBLIC_URL env var is not set");
  return u.replace(/\/$/, "");
};

export function getPublicUrl(key: string): string {
  return `${PUBLIC()}/${key}`;
}

export async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<string> {
  if (body.byteLength > 10 * 1024 * 1024) {
    return uploadMultipartToR2(key, body, contentType);
  }
  const client = getClient();
  await client.send(new PutObjectCommand({ Bucket: BUCKET(), Key: key, Body: body, ContentType: contentType }));
  return getPublicUrl(key);
}

async function uploadMultipartToR2(key: string, buf: Buffer, contentType: string): Promise<string> {
  const client = getClient();
  const PART_SIZE = 50 * 1024 * 1024; // 50 MB per part

  const init = await client.send(new CreateMultipartUploadCommand({ Bucket: BUCKET(), Key: key, ContentType: contentType }));
  const uploadId = init.UploadId!;

  const parts: { PartNumber: number; ETag: string }[] = [];
  const totalParts = Math.ceil(buf.byteLength / PART_SIZE);
  try {
    for (let i = 0; i < totalParts; i++) {
      const start = i * PART_SIZE;
      const chunk = buf.subarray(start, start + PART_SIZE);
      const res = await client.send(new UploadPartCommand({ Bucket: BUCKET(), Key: key, UploadId: uploadId, PartNumber: i + 1, Body: chunk }));
      parts.push({ PartNumber: i + 1, ETag: res.ETag! });
    }
  } catch (err) {
    await client.send(new AbortMultipartUploadCommand({ Bucket: BUCKET(), Key: key, UploadId: uploadId })).catch(() => {});
    throw err;
  }

  await client.send(new CompleteMultipartUploadCommand({ Bucket: BUCKET(), Key: key, UploadId: uploadId, MultipartUpload: { Parts: parts } }));
  return getPublicUrl(key);
}
