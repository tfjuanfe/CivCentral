import "server-only";
import { headers } from "next/headers";
import { prisma } from "./db";

// Best-effort client IP from proxy headers (Vercel sets x-forwarded-for).
export async function clientIp(): Promise<string> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return h.get("x-real-ip") ?? "unknown";
}

export type RateResult = { ok: true } | { ok: false; retryAfter: number };

// Fixed-window limiter backed by the database, so the count is shared across
// serverless instances. Fail closed if the limiter is unavailable so login
// and upload limits cannot silently disappear during a database error.
export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateResult> {
  const now = Date.now();
  const reset = new Date(now + windowSeconds * 1000);
  try {
    // Single atomic statement: insert a fresh counter, or — on conflict — reset
    // it if the window has elapsed, otherwise increment. Doing the read, reset,
    // and increment in one round trip closes the race where two concurrent
    // requests both pass the check or both reset the window.
    const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
      INSERT INTO "RateLimit" ("key", "count", "resetAt")
      VALUES (${key}, 1, ${reset})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE WHEN "RateLimit"."resetAt" <= now()
                       THEN 1 ELSE "RateLimit"."count" + 1 END,
        "resetAt" = CASE WHEN "RateLimit"."resetAt" <= now()
                         THEN ${reset} ELSE "RateLimit"."resetAt" END
      RETURNING "count", "resetAt"
    `;
    const row = rows[0];

    // Opportunistically sweep expired counters (~1% of calls) so the table
    // doesn't grow without bound. Best-effort; failures are ignored.
    if (Math.random() < 0.01) {
      prisma.rateLimit
        .deleteMany({ where: { resetAt: { lte: new Date() } } })
        .catch(() => {});
    }

    if (Number(row.count) > limit) {
      return {
        ok: false,
        retryAfter: Math.max(
          1,
          Math.ceil((row.resetAt.getTime() - now) / 1000),
        ),
      };
    }
    return { ok: true };
  } catch {
    console.error("[ratelimit] Counter unavailable");
    return { ok: false, retryAfter: 60 };
  }
}

// Friendly "try again in ..." text.
export function retryMessage(seconds: number): string {
  if (seconds >= 60) {
    const m = Math.ceil(seconds / 60);
    return `Too many attempts. Try again in about ${m} minute${m === 1 ? "" : "s"}.`;
  }
  return `Too many attempts. Try again in ${seconds} second${seconds === 1 ? "" : "s"}.`;
}
