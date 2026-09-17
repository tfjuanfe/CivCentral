import { describe, expect, it } from "vitest";
import { MAX_MEDIA_BYTES, matchesMediaSignature, mediaError, mediaKind } from "./media";
import { contributionProgress } from "./contributions";
import { safeRedirect } from "./validation";
import { accountIsActive, passwordVersion, sessionSecret } from "./account-security";
import { BodyTooLargeError, readBoundedBody } from "./request-body";

describe("media validation", () => {
  it("accepts exactly 10 MB but rejects one byte more, empty and invalid sizes", () => {
    expect(mediaError(MAX_MEDIA_BYTES, "image/png")).toBeNull();
    for (const size of [MAX_MEDIA_BYTES + 1, 0, -1, NaN, Infinity, 1.2]) expect(mediaError(size, "image/png")).not.toBeNull();
  });
  it("allows media but only images for avatars; rejects active content and inherited keys", () => {
    expect(mediaError(50, "video/mp4")).toBeNull();
    for (const type of ["image/svg+xml", "text/html", "application/javascript", "toString", "__proto__"]) expect(mediaError(50, type)).not.toBeNull();
    expect(mediaError(50, "video/mp4", true)).not.toBeNull();
  });
  it("checks bytes instead of trusting extensions or declared MIME types", () => {
    const png = Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,1]);
    expect(matchesMediaSignature(png, "image/png")).toBe(true);
    expect(matchesMediaSignature(png, "image/jpeg")).toBe(false);
    expect(matchesMediaSignature(new TextEncoder().encode('<svg onload="alert(1)"></svg>'), "image/png")).toBe(false);
    expect(matchesMediaSignature(new Uint8Array(0), "image/png")).toBe(false);
    expect(matchesMediaSignature(new TextEncoder().encode("RIFF0000WEBPVP8 "), "image/webp")).toBe(true);
    expect(matchesMediaSignature(new TextEncoder().encode("RIFF0000WAVEfmt "), "audio/wav")).toBe(true);
    expect(matchesMediaSignature(new TextEncoder().encode("0000ftypmp420000"), "video/mp4")).toBe(true);
  });
  it("recognizes media paths without being fooled by query strings", () => {
    expect(mediaKind("https://media.test/clip.mp4?download=1")).toBe("video");
    expect(mediaKind("https://media.test/sound.mp3")).toBe("audio");
    expect(mediaKind("https://source.test/article?file=photo.png")).toBe("link");
  });
});

describe("bounded request streams", () => {
  it("reads the exact limit across chunks", async () => {
    const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array([1,2])); c.enqueue(new Uint8Array([3])); c.close(); } });
    expect(await readBoundedBody(body, 3)).toEqual(new Uint8Array([1,2,3]));
  });
  it("cancels streams that exceed the limit without relying on headers", async () => {
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(new Uint8Array(5)); }, cancel() { cancelled = true; } });
    await expect(readBoundedBody(body, 4)).rejects.toBeInstanceOf(BodyTooLargeError);
    expect(cancelled).toBe(true);
  });
});

describe("published article milestones", () => {
  it.each([[0,0,5],[4,0,5],[5,5,10],[9,5,10],[10,10,15],[15,15,20],[103,100,105]])("counts %i articles", (count, milestone, next) => {
    expect(contributionProgress(count)).toMatchObject({ count, milestone, next, remaining: next - count });
  });
});

describe("account security", () => {
  it("invalidates session versions when the stored password changes", () => {
    expect(passwordVersion("old-bcrypt-hash")).not.toBe(passwordVersion("new-bcrypt-hash"));
  });
  it("rejects missing, short and published default production secrets", () => {
    for (const secret of [
      undefined,
      "short",
      "change-me-to-a-long-random-string",
      "dev-only-insecure-secret-change-me",
      "c464204e06117aea5093c4abbca023f9edbe424d45b4866476ed7c17e5f57a22",
    ])
      expect(() => sessionSecret(secret, true)).toThrow();
    expect(sessionSecret("random-per-deployment-secret-of-at-least-32-characters", true).length).toBeGreaterThan(32);
  });
  it("allows suspended users to read while denying banned and unknown states", () => {
    expect(accountIsActive({ status: "active" })).toBe(true);
    expect(accountIsActive({ status: "suspended" })).toBe(true);
    for (const status of ["banned", "deleted", "unknown"])
      expect(accountIsActive({ status })).toBe(false);
  });
  it("only allows local login destinations", () => {
    expect(safeRedirect("/me?tab=profile#avatar")).toBe("/me?tab=profile#avatar");
    for (const dest of ["javascript:alert(1)", "https://attacker.test", "//attacker.test", "/\\attacker.test", "/\n/attacker.test", "/\t/attacker.test"])
      expect(safeRedirect(dest)).toBe("/");
  });
});
