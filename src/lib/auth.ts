import "server-only";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { accountIsActive, passwordVersion, sessionSecret } from "./account-security";
import { prisma } from "./db";
import type { AccountStatus, Role, SessionUser } from "./types";

const COOKIE_NAME = "civcentral_session";
const MAX_AGE = 60 * 60 * 24 * 30;

function authSecret(): Uint8Array {
  return sessionSecret(
    process.env.AUTH_SECRET,
    process.env.NODE_ENV === "production",
  );
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  if (typeof password !== "string" || password.length > 200) return false;
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

// Return cookie data so route handlers such as the Discord callback can set
// the same hardened session cookie on their redirect response.
export async function sessionCookie(userId: string): Promise<SessionCookie> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true, status: true },
  });
  if (!user || !accountIsActive(user)) throw new Error("UNAUTHENTICATED");

  const token = await new SignJWT({
    uid: userId,
    pv: passwordVersion(user.passwordHash),
  })
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
  (await cookies()).set(name, value, options);
}

export async function destroySession(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, authSecret(), {
      algorithms: ["HS256"],
    });
    const uid = payload.uid;
    if (typeof uid !== "string" || !uid) return null;

    const user = await prisma.user.findUnique({
      where: { id: uid },
      select: {
        id: true,
        passwordHash: true,
        username: true,
        role: true,
        trusted: true,
        eventHost: true,
        email: true,
        emailVerified: true,
        status: true,
        suspendedUntil: true,
      },
    });
    if (
      !user ||
      !accountIsActive(user) ||
      payload.pv !== passwordVersion(user.passwordHash)
    ) {
      return null;
    }

    const status = user.status as AccountStatus;
    const suspended =
      status === "suspended" &&
      (user.suspendedUntil === null || user.suspendedUntil > new Date());

    return {
      id: user.id,
      username: user.username,
      role: user.role as Role,
      trusted: user.trusted,
      eventHost: user.eventHost,
      email: user.email,
      emailVerified: user.emailVerified,
      status,
      suspended,
      suspendedUntil: suspended ? user.suspendedUntil : null,
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
