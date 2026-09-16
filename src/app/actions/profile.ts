"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import {
  getCurrentUser,
  destroySession,
  hashPassword,
  verifyPassword,
} from "@/lib/auth";
import { rateLimit, retryMessage } from "@/lib/ratelimit";

export type ProfileResult = { ok: true } | { ok: false; error: string };

// Detach a linked Discord identity from the signed-in account.
//
// Refuses when Discord is the only way in. An account created through Discord
// sign-in has no password, so unlinking without setting one first would leave
// nobody - including the owner - able to log in again.
export async function unlinkDiscord(): Promise<ProfileResult> {
  const session = await getCurrentUser();
  if (!session) return { ok: false, error: "You must be logged in." };

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { discordId: true, passwordHash: true },
  });
  if (!user) return { ok: false, error: "You must be logged in." };
  if (!user.discordId)
    return { ok: false, error: "No Discord account is linked." };
  if (!user.passwordHash)
    return {
      ok: false,
      error:
        "Set a password first — Discord is currently the only way into this account.",
    };

  await prisma.user.update({
    where: { id: session.id },
    data: { discordId: null, discordUsername: null, discordAvatar: null },
  });
  revalidatePath("/me");
  return { ok: true };
}

export async function updateProfile(bio: string): Promise<ProfileResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "You must be logged in." };

  const clean = bio.trim();
  if (clean.length > 500)
    return { ok: false, error: "Bio is too long (500 characters max)." };

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { bio: clean },
    select: { username: true },
  });

  revalidatePath(`/users/${updated.username}`);
  return { ok: true };
}

// Change the signed-in user's password. Requires the current password so a
// hijacked-but-unlocked session can't silently lock the owner out.
export async function changePassword(
  current: string,
  next: string,
): Promise<ProfileResult> {
  const session = await getCurrentUser();
  if (!session) return { ok: false, error: "You must be logged in." };

  const rl = await rateLimit(`pwchange:${session.id}`, 5, 600);
  if (!rl.ok) return { ok: false, error: retryMessage(rl.retryAfter) };

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { passwordHash: true },
  });
  if (!user) return { ok: false, error: "You must be logged in." };

  // A Discord-created account has no password yet, so there is nothing to
  // confirm against: this call is "set my first password". Everything else
  // still requires the current one, so an unlocked session can't silently
  // change a password the owner knows and lock them out.
  if (user.passwordHash) {
    if (!(await verifyPassword(current, user.passwordHash)))
      return { ok: false, error: "Your current password is incorrect." };
  }

  if (next.length < 8)
    return { ok: false, error: "New password must be at least 8 characters." };
  if (next.length > 200)
    return { ok: false, error: "New password is too long." };
  if (next === current)
    return {
      ok: false,
      error: "New password must be different from your current one.",
    };

  await prisma.user.update({
    where: { id: session.id },
    data: { passwordHash: await hashPassword(next) },
  });
  return { ok: true };
}

// Delete the signed-in user's account. Requires the password to confirm.
//
// Anonymize-and-keep: if the user has authored entries or revisions we keep
// the row (so "every telling has a home" still holds) but scrub all personal
// data and make the account unusable. Users who never contributed are removed
// outright — their stars/comments/ratings/tokens cascade away. Either way the
// session is destroyed.
export async function deleteAccount(
  password: string,
  confirmation?: string,
): Promise<ProfileResult> {
  const session = await getCurrentUser();
  if (!session) return { ok: false, error: "You must be logged in." };

  const rl = await rateLimit(`pwdel:${session.id}`, 5, 600);
  if (!rl.ok) return { ok: false, error: retryMessage(rl.retryAfter) };

  const user = await prisma.user.findUnique({
    where: { id: session.id },
    select: { passwordHash: true },
  });
  if (!user) return { ok: false, error: "You must be logged in." };

  if (user.passwordHash) {
    if (!(await verifyPassword(password, user.passwordHash)))
      return { ok: false, error: "Password is incorrect." };
  } else if (confirmation?.trim() !== "DELETE") {
    // A Discord-only account has no password to confirm with, so the typed
    // confirmation is the deliberate step. Checked on the server, not just in
    // the dialog, so it can't be skipped by calling the action directly.
    return { ok: false, error: 'Type DELETE to confirm.' };
  }

  const [entries, revisions] = await Promise.all([
    prisma.entry.count({ where: { authorId: session.id } }),
    prisma.revision.count({ where: { editorId: session.id } }),
  ]);

  if (entries === 0 && revisions === 0) {
    await prisma.user.delete({ where: { id: session.id } });
  } else {
    // Keep authored content; strip everything that identifies the person and
    // set an unusable password so the account can never be logged into again.
    //
    // Clearing the Discord association is part of that, and not only for
    // privacy: leaving discordId set would let the next Discord sign-in match
    // this dead row and log the user straight back into the account they
    // deleted. It would also permanently block them from signing up again with
    // the same Discord identity.
    const handle = `deleted_${randomBytes(5).toString("hex")}`;
    const deadHash = await hashPassword(randomBytes(24).toString("hex"));
    await prisma.user.update({
      where: { id: session.id },
      data: {
        username: handle,
        email: null,
        emailVerified: false,
        passwordHash: deadHash,
        discordId: null,
        discordUsername: null,
        discordAvatar: null,
        avatarUrl: null,
        bio: "",
        trusted: false,
        eventHost: false,
        role: "contributor",
      },
    });
  }

  destroySession();
  revalidatePath("/", "layout");
  return { ok: true };
}
