import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canContributeNow, VERIFY_EMAIL_MESSAGE } from "@/lib/permissions";
import { rateLimit, retryMessage } from "@/lib/ratelimit";
import { deleteObject, presignUpload, putObject, readUploadedObject, storageConfigured } from "@/lib/storage";
import { MAX_MEDIA_BYTES, MEDIA_TYPES, mediaError, matchesMediaSignature } from "@/lib/media";
import { BodyTooLargeError, readBoundedBody } from "@/lib/request-body";

export const runtime = "nodejs";
export const maxDuration = 60;

function json(body: unknown, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

// Files go directly to R2, bypassing Vercel's smaller request-body limit.
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const expectedOrigin = process.env.NEXT_PUBLIC_APP_URL || req.url;
  if (!origin || origin !== new URL(expectedOrigin).origin)
    return json({ error: "Upload requests must come from this site." }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: "Log in to upload." }, 401);
  if (!canContributeNow(user)) return json({ error: VERIFY_EMAIL_MESSAGE }, 403);
  if (!storageConfigured()) return json({ error: "Uploads aren't configured yet. Please try again later or use a preset avatar." }, 503);
  if (req.headers.get("content-type")?.split(";")[0] !== "application/json")
    return json({ error: "Expected upload metadata." }, 415);

  let data: Record<string, unknown>;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(await readBoundedBody(req.body, 4096)));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    data = parsed;
  } catch (err) {
    return json({ error: "Invalid upload metadata." }, err instanceof BodyTooLargeError ? 413 : 400);
  }
  if (data.action !== "start" && data.action !== "complete") return json({ error: "Unknown upload action." }, 400);
  if (data.purpose !== "avatar" && data.purpose !== "media") return json({ error: "Unknown upload purpose." }, 400);
  const rl = await rateLimit(`upload:${data.action}:${user.id}`, 30, 600);
  if (!rl.ok) return json({ error: retryMessage(rl.retryAfter) }, 429);

  try {
    if (data.action === "start") {
      if (typeof data.type !== "string" || typeof data.size !== "number") return json({ error: "Invalid file metadata." }, 400);
      const error = mediaError(data.size, data.type, data.purpose === "avatar");
      if (error) return json({ error }, data.size > MAX_MEDIA_BYTES ? 413 : 415);
      const key = `staging/${user.id}/${data.purpose}/${randomBytes(16).toString("hex")}.${MEDIA_TYPES[data.type]}`;
      return json({ key, uploadUrl: await presignUpload(key, data.size) }, 200);
    }
    const prefix = `staging/${user.id}/${data.purpose}/`;
    if (typeof data.key !== "string" || !data.key.startsWith(prefix) ||
        !/^[a-f0-9]{32}\.(png|jpg|webp|gif|mp4|webm|mp3|ogg|wav)$/.test(data.key.slice(prefix.length)))
      return json({ error: "Invalid upload key." }, 400);
    const key = data.key;
    const ext = key.split(".").pop()!;
    const type = Object.keys(MEDIA_TYPES).find(t => MEDIA_TYPES[t] === ext)!;
    const bytes = await readUploadedObject(key);
    const error = mediaError(bytes.length, type, data.purpose === "avatar");
    if (error || !matchesMediaSignature(bytes, type)) {
      await deleteObject(key);
      return json({ error: error || "The file contents do not match the selected media type." }, 415);
    }
    // Publish validated bytes under a NEW key. Replaying a staging PUT can
    // never replace approved media, even during a concurrent upload.
    const finalKey = `uploads/${user.id}/${randomBytes(16).toString("hex")}.${ext}`;
    const url = await putObject(finalKey, bytes, type);
    if (data.purpose === "avatar") {
      await prisma.user.update({ where: { id: user.id }, data: { avatarUrl: url } });
      revalidatePath(`/users/${user.username}`);
      revalidatePath("/me");
    }
    await deleteObject(key).catch(() => console.error("[upload] staging cleanup failed"));
    return json({ url }, 200);
  } catch {
    console.error("[upload] storage operation failed");
    return json({ error: "Upload failed. Please try again." }, 502);
  }
}
