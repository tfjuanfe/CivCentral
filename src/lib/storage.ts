import "server-only";
import { AwsClient } from "aws4fetch";
import { MAX_MEDIA_BYTES } from "./media";
import { readBoundedBody } from "./request-body";

// Object storage on Cloudflare R2 (S3-compatible), reached with lightweight
// SigV4 signing via aws4fetch — no heavy AWS SDK. This is the single seam every
// uploaded asset (evidence images, avatars, event banners) goes through, so it
// can be swapped for another S3-compatible backend by changing only this file.
//
// Required env (see .env.example):
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
//   R2_PUBLIC_BASE_URL  (public bucket URL or custom domain used to serve objects)

const accountId = process.env.R2_ACCOUNT_ID;
const accessKeyId = process.env.R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const bucket = process.env.R2_BUCKET;
const publicBase = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, "");

// Whether storage is wired up. Callers (e.g. the upload route) should check this
// and fail gracefully when uploads aren't configured rather than throwing.
export function storageConfigured(): boolean {
  return Boolean(accountId && accessKeyId && secretAccessKey && bucket && publicBase?.startsWith("https://"));
}

let client: AwsClient | null = null;
function awsClient(): AwsClient {
  if (!storageConfigured()) {
    throw new Error("R2 storage is not configured (missing R2_* env vars).");
  }
  if (!client) {
    client = new AwsClient({
      accessKeyId: accessKeyId!,
      secretAccessKey: secretAccessKey!,
      region: "auto",
      service: "s3",
    });
  }
  return client;
}

function objectUrl(key: string): string {
  const safeKey = key.split("/").map(encodeURIComponent).join("/");
  return `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${safeKey}`;
}

// Public URL an object is served from. Prefer the configured public base
// (a public bucket or custom domain); fall back to the S3 endpoint.
export function getPublicUrl(key: string): string {
  const safeKey = key.split("/").map(encodeURIComponent).join("/");
  return publicBase ? `${publicBase}/${safeKey}` : objectUrl(key);
}

// Upload bytes and return the public URL to serve them from.
export async function putObject(
  key: string,
  body: ArrayBuffer | Uint8Array,
  contentType: string,
): Promise<string> {
  const res = await awsClient().fetch(objectUrl(key), {
    method: "PUT",
    body,
    headers: { "Content-Type": contentType, "Content-Disposition": "inline", "Cache-Control": "public, max-age=31536000, immutable" },
  });
  if (!res.ok) {
    throw new Error(`R2 upload failed (${res.status} ${res.statusText}).`);
  }
  return getPublicUrl(key);
}

// Delete an object. A missing object (404) is treated as success.
export async function deleteObject(key: string): Promise<void> {
  const res = await awsClient().fetch(objectUrl(key), { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    throw new Error(`R2 delete failed (${res.status} ${res.statusText}).`);
  }
}

// The browser sets Content-Length for a File body. Signing it prevents clients
// from using a small-file authorization to store a larger object.
export async function presignUpload(key: string, size: number): Promise<string> {
  const url = new URL(objectUrl(key));
  url.searchParams.set("X-Amz-Expires", "300");
  const signed = await awsClient().sign(url.toString(), {
    method: "PUT",
    headers: { "Content-Type": "application/octet-stream", "Content-Length": String(size), "Content-Disposition": "attachment" },
    aws: { signQuery: true, allHeaders: true },
  });
  return signed.url;
}

export async function readUploadedObject(key: string): Promise<Uint8Array> {
  const res = await awsClient().fetch(objectUrl(key), { signal: AbortSignal.timeout(30_000) });
  if (!res.ok) throw new Error(`R2 read failed (${res.status}).`);
  if (Number(res.headers.get("content-length")) > MAX_MEDIA_BYTES) {
    await res.body?.cancel();
    throw new Error("Uploaded object exceeds the size limit.");
  }
  return readBoundedBody(res.body, MAX_MEDIA_BYTES);
}
