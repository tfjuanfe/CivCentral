"use server";

import { accountIsActive } from "@/lib/account-security";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { clientIp, rateLimit, retryMessage } from "@/lib/ratelimit";
import { isValidEmail, normalizeEmail, sendVerificationEmail } from "@/lib/email";
import { issueVerificationToken } from "@/lib/verification";

export type AuthResult = { ok: true } | { ok: false; error: string };

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

// A valid bcrypt hash to compare against when the username doesn't exist, so
// login spends the same time whether or not the account is real (prevents
// user enumeration via response timing). Not a usable password.
const DUMMY_HASH =
  "$2a$10$iAkS/etJ10cd7kYDgv6Qiugp4RtOEzXpz0EnMqG/U4041hhyv5J3.";

export async function register(
  username: string,
  password: string,
  rawEmail?: string,
): Promise<AuthResult> {
  const rl = await rateLimit(`register:${await clientIp()}`, 5, 3600);
  if (!rl.ok) return { ok: false, error: retryMessage(rl.retryAfter) };

  username = username.trim();
  if (!USERNAME_RE.test(username)) {
    return {
      ok: false,
      error: "Username must be 3 to 20 letters, numbers, or underscores.",
    };
  }
  if (password.length < 8) {
    return { ok: false, error: "Password must be at least 8 characters." };
  }
  if (Buffer.byteLength(password, "utf8") > 72) {
    return { ok: false, error: "Password must be at most 72 UTF-8 bytes." };
  }

  // Email is optional at signup, but if supplied it must be valid and unused.
  const email = rawEmail ? normalizeEmail(rawEmail) : "";
  if (email) {
    if (!isValidEmail(email))
      return { ok: false, error: "Please enter a valid email address." };
    const emailTaken = await prisma.user.findUnique({ where: { email } });
    // Only a VERIFIED owner blocks the address. An address merely held
    // unverified (e.g. a squatter) is released so the new account can claim it.
    if (emailTaken?.emailVerified)
      return { ok: false, error: "That email is already in use." };
    if (emailTaken && !emailTaken.emailVerified)
      await prisma.user.update({
        where: { id: emailTaken.id },
        data: { email: null },
      });
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return { ok: false, error: "That username is already taken." };
  }

  const user = await prisma.user.create({
    data: {
      username,
      passwordHash: await hashPassword(password),
      role: "contributor",
      trusted: false,
      email: email || null,
      emailVerified: false,
    },
  });

  // Fire off the verification email (best effort — signup still succeeds even
  // if delivery fails; the user can resend from /me).
  if (email) {
    const link = await issueVerificationToken(user.id, email);
    await sendVerificationEmail(email, link);
  }

  await createSession(user.id);
  return { ok: true };
}

export async function login(
  username: string,
  password: string,
): Promise<AuthResult> {
  const rl = await rateLimit(`login:${await clientIp()}`, 10, 300);
  if (!rl.ok) return { ok: false, error: retryMessage(rl.retryAfter) };

  username = username.trim();
  const user = await prisma.user.findUnique({ where: { username } });
  // Always run a bcrypt comparison (against a dummy hash when the user is
  // missing) so the timing is identical for real and unknown usernames.
  const passwordOk = await verifyPassword(
    password,
    user?.passwordHash ?? DUMMY_HASH,
  );
  if (!user || !passwordOk || !accountIsActive(user)) {
    return { ok: false, error: "Invalid username or password." };
  }

  await createSession(user.id);
  return { ok: true };
}

export async function logout(): Promise<void> {
  await destroySession();
  revalidatePath("/", "layout");
  redirect("/");
}
