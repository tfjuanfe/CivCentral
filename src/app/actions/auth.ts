"use server";

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

export async function register(
  username: string,
  password: string,
  rawEmail?: string,
  acceptedTerms?: boolean,
): Promise<AuthResult> {
  const rl = await rateLimit(`register:${clientIp()}`, 5, 3600);
  if (!rl.ok) return { ok: false, error: retryMessage(rl.retryAfter) };

  // Consent is recorded server-side, not just enforced by the checkbox, so the
  // timestamp we store is a real record of agreement.
  if (!acceptedTerms) {
    return {
      ok: false,
      error:
        "Please accept the Terms of Use and Privacy Policy to create an account.",
    };
  }

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
  if (password.length > 200) {
    return { ok: false, error: "Password is too long." };
  }

  // Email is optional at signup, but if supplied it must be valid and unused.
  const email = rawEmail ? normalizeEmail(rawEmail) : "";
  if (email) {
    if (!isValidEmail(email))
      return { ok: false, error: "Please enter a valid email address." };
    const emailTaken = await prisma.user.findUnique({ where: { email } });
    if (emailTaken)
      return { ok: false, error: "That email is already in use." };
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
      termsAcceptedAt: new Date(),
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
  const rl = await rateLimit(`login:${clientIp()}`, 10, 300);
  if (!rl.ok) return { ok: false, error: retryMessage(rl.retryAfter) };

  username = username.trim();
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.passwordHash || !(await verifyPassword(password, user.passwordHash))) {
    return { ok: false, error: "Invalid username or password." };
  }

  await createSession(user.id);
  return { ok: true };
}

export async function logout(): Promise<void> {
  destroySession();
  revalidatePath("/", "layout");
  redirect("/");
}
