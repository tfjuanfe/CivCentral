import { createHash } from "crypto";

const PUBLISHED_AUTH_SECRET =
  "c464204e06117aea5093c4abbca023f9edbe424d45b4866476ed7c17e5f57a22";

export function passwordVersion(hash: string | null | undefined): string {
  return createHash("sha256").update(`password:${hash ?? "none"}`).digest("hex");
}

export function sessionSecret(secret: string | undefined, production: boolean): Uint8Array {
  if (production && (!secret || secret.length < 32 ||
      secret === "change-me-to-a-long-random-string" ||
      secret === "dev-only-insecure-secret-change-me" ||
      secret === PUBLISHED_AUTH_SECRET)) {
    throw new Error("Set AUTH_SECRET to a fresh random secret of at least 32 characters. Published example secrets are not allowed.");
  }
  return new TextEncoder().encode(secret || "dev-only-insecure-secret-change-me");
}

export function accountIsActive(user: { status: string }): boolean {
  // Suspended members may still sign in and read their suspension notice.
  // Permission checks block their writes. Banned and unknown states never get
  // a session.
  return user.status === "active" || user.status === "suspended";
}
