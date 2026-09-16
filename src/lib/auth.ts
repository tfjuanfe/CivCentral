import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "./db";
import type { Role, SessionUser } from "./types";

const COOKIE_NAME = "wikiciv_session";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

// Resolve the signing secret at request time. In production we refuse to fall
// back to the public dev string: a missing AUTH_SECRET must fail loudly rather
// than sign sessions with a secret that's visible in the repo (which would let
// anyone forge a session for any user, including an archivist).
function authSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (secret) return new TextEncoder().encode(secret);
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "AUTH_SECRET is not set. Refusing to sign or verify sessions with an insecure fallback in production.",
    );
  }
  return new TextEncoder().encode("dev-only-insecure-secret-change-me");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface SessionCookie {
  name: string;
  value: string;
  options: {
    httpOnly: true;
    sameSite: "lax";
    secure: boolean;
    path: string;
    maxAge: number;
  };
}

// Build the signed session cookie for a user, returned as data. Server actions
// set it on the next/headers cookie store; OAuth route handlers set it directly
// on the NextResponse redirect they return.
export async function sessionCookie(userId: string): Promise<SessionCookie> {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(authSecret());

  return {
    name: COOKIE_NAME,
    value: token,
    options: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: MAX_AGE,
    },
  };
}

export async function createSession(userId: string): Promise<void> {
  const { name, value, options } = await sessionCookie(userId);
  cookies().set(name, value, options);
}

export function destroySession(): void {
  cookies().delete(COOKIE_NAME);
}

// Returns the logged-in user, or null for anonymous readers.
export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, authSecret());
    const uid = payload.uid as string | undefined;
    if (!uid) return null;

    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: {
        id: true,
        username: true,
        role: true,
        trusted: true,
        email: true,
        emailVerified: true,
        bannedAt: true,
        bannedUntil: true,
        banReason: true,
      },
    });
    if (!user) return null;

    // A timed ban expires on its own: it is still recorded on the row, but we
    // stop treating the user as banned once `bannedUntil` has passed.
    const banned =
      !!user.bannedAt &&
      (user.bannedUntil === null || user.bannedUntil > new Date());

    return {
      id: user.id,
      username: user.username,
      role: user.role as Role,
      trusted: user.trusted,
      email: user.email,
      emailVerified: user.emailVerified,
      banned,
      banReason: banned ? user.banReason : null,
      bannedUntil: banned ? user.bannedUntil : null,
    };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  return user;
}

export async function requireArchivist(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "archivist") throw new Error("FORBIDDEN");
  return user;
}
