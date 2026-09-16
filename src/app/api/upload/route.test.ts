import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: vi.fn(), limit: vi.fn(), configured: vi.fn(), presign: vi.fn(), read: vi.fn(), put: vi.fn(), remove: vi.fn(), update: vi.fn(), revalidate: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getCurrentUser: mocks.user }));
vi.mock("@/lib/db", () => ({ prisma: { user: { update: mocks.update } } }));
vi.mock("@/lib/ratelimit", () => ({ rateLimit: mocks.limit, retryMessage: () => "Too many attempts." }));
vi.mock("@/lib/storage", () => ({ storageConfigured: mocks.configured, presignUpload: mocks.presign, readUploadedObject: mocks.read, putObject: mocks.put, deleteObject: mocks.remove }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { POST } from "./route";
import { MAX_MEDIA_BYTES } from "@/lib/media";

const key = `staging/user1/media/${"a".repeat(32)}.png`;
const png = Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1]);
function request(data: unknown, origin = "https://wikiciv.xyz") {
  return new Request("https://wikiciv.xyz/api/upload", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(data) });
}
const start = { action: "start", purpose: "media", type: "image/png", size: 100 };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://wikiciv.xyz");
  mocks.user.mockResolvedValue({ id: "user1", username: "alice", role: "contributor", emailVerified: true });
  mocks.limit.mockResolvedValue({ ok: true });
  mocks.configured.mockReturnValue(true);
  mocks.presign.mockResolvedValue("https://r2.test/signed-upload");
  mocks.read.mockResolvedValue(png);
  mocks.put.mockResolvedValue("https://media.test/uploads/user1/final.png");
  mocks.remove.mockResolvedValue(undefined);
  mocks.update.mockResolvedValue({});
});

describe("upload authorization", () => {
  it("rejects cross-origin and missing-origin requests before issuing storage URLs", async () => {
    for (const origin of ["https://attacker.test", "", "null"]) expect((await POST(request(start, origin))).status).toBe(403);
    expect(mocks.presign).not.toHaveBeenCalled();
  });
  it("requires an authenticated verified contributor", async () => {
    mocks.user.mockResolvedValueOnce(null);
    expect((await POST(request(start))).status).toBe(401);
    mocks.user.mockResolvedValueOnce({ id: "user1", role: "contributor", emailVerified: false });
    expect((await POST(request(start))).status).toBe(403);
    mocks.user.mockResolvedValueOnce({ id: "user1", role: "reader", emailVerified: true });
    expect((await POST(request(start))).status).toBe(403);
  });
  it("enforces server-side size, type, metadata limits and image-only avatars", async () => {
    expect((await POST(request({ ...start, size: MAX_MEDIA_BYTES + 1 }))).status).toBe(413);
    expect((await POST(request({ ...start, type: "text/html" }))).status).toBe(415);
    expect((await POST(request({ ...start, purpose: "avatar", type: "video/mp4" }))).status).toBe(415);
    expect((await POST(request({ ...start, extra: "x".repeat(5000) }))).status).toBe(413);
    expect(mocks.presign).not.toHaveBeenCalled();
    expect((await POST(request({ ...start, size: MAX_MEDIA_BYTES }))).status).toBe(200);
    expect(mocks.presign).toHaveBeenCalledWith(expect.stringMatching(/^staging\/user1\/media\/[a-f0-9]{32}\.png$/), MAX_MEDIA_BYTES);
  });
  it("fails safely when storage is unconfigured or requests are rate limited", async () => {
    mocks.configured.mockReturnValueOnce(false);
    expect((await POST(request(start))).status).toBe(503);
    mocks.limit.mockResolvedValueOnce({ ok: false, retryAfter: 60 });
    expect((await POST(request(start))).status).toBe(429);
  });
});

describe("upload finalization", () => {
  it("rejects foreign, traversal, and cross-purpose keys without reading storage", async () => {
    for (const invalid of [key.replace("user1", "user2"), key.replace("media", "avatar"), "staging/user1/media/../../other.png", "uploads/user1/photo.png"])
      expect((await POST(request({ action: "complete", purpose: "media", key: invalid }))).status).toBe(400);
    expect(mocks.read).not.toHaveBeenCalled();
  });
  it("rejects and deletes mislabeled files before publishing", async () => {
    mocks.read.mockResolvedValue(new TextEncoder().encode("<html><script>alert(1)</script></html>"));
    expect((await POST(request({ action: "complete", purpose: "media", key }))).status).toBe(415);
    expect(mocks.remove).toHaveBeenCalledWith(key);
    expect(mocks.put).not.toHaveBeenCalled();
  });
  it("publishes validated bytes to an immutable new key and cleans staging", async () => {
    const result = await POST(request({ action: "complete", purpose: "media", key }));
    expect(result.status).toBe(200);
    expect(mocks.put).toHaveBeenCalledWith(expect.stringMatching(/^uploads\/user1\/[a-f0-9]{32}\.png$/), png, "image/png");
    expect(mocks.remove).toHaveBeenCalledWith(key);
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("only changes the authenticated user's avatar after validation", async () => {
    expect((await POST(request({ action: "complete", purpose: "avatar", key: key.replace("media", "avatar") }))).status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({ where: { id: "user1" }, data: { avatarUrl: "https://media.test/uploads/user1/final.png" } });
  });
  it("returns a recoverable error without exposing storage credentials", async () => {
    mocks.put.mockRejectedValue(new Error("internal storage credentials"));
    const result = await POST(request({ action: "complete", purpose: "media", key }));
    expect(result.status).toBe(502);
    expect(await result.text()).not.toContain("credentials");
  });
});
