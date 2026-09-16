import { createHash } from "crypto";

export function passwordVersion(hash: string | null | undefined): string {
  return createHash("sha256").update(`password:${hash ?? "none"}`).digest("hex");
}

export function sessionSecret(secret: string | undefined, production: boolean): Uint8Array {
  if (production && (!secret || secret.length < 32 ||
      secret === "change-me-to-a-long-random-string" ||
      secret === "dev-only-insecure-secret-change-me" ||
      passwordVersion(secret) === "e536cb55cdfd2c191dde9d8923da1043930a1da85247023e7d41c9351e6058b0")) {
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
