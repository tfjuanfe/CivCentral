import "server-only";
import { prisma } from "./db";
import { getBaseUrl } from "./email";
import { normalizeEmail } from "./email";

// Discord OAuth2 (Authorization Code grant). The token exchange and the profile
// fetch both happen server-side, so only the top-level browser redirects ever
// touch discord.com.

export interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
  email?: string | null;
  verified?: boolean;
  avatar?: string | null;
}

// Thrown for conditions the callback should report to the user rather than
// swallow as a generic failure.
export class DiscordLinkError extends Error {}

export function isDiscordConfigured(): boolean {
  return !!(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);
}

// The redirect URI must match a value registered on the Discord application
// exactly. Prefer an explicit env var; otherwise derive it from the request.
export function discordRedirectUri(): string {
  const explicit = process.env.DISCORD_REDIRECT_URI?.trim();
  if (explicit) return explicit;
  return `${getBaseUrl()}/api/auth/discord/callback`;
}

export function discordAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID ?? "",
    redirect_uri: discordRedirectUri(),
    response_type: "code",
    scope: "identify email",
    state,
  });
  return `https://discord.com/api/oauth2/authorize?${params.toString()}`;
}

export async function exchangeDiscordCode(code: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID ?? "",
    client_secret: process.env.DISCORD_CLIENT_SECRET ?? "",
    grant_type: "authorization_code",
    code,
    redirect_uri: discordRedirectUri(),
  });
  const res = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Discord token exchange failed (${res.status})`);
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token)
    throw new Error("Discord token response missing access_token");
  return data.access_token;
}

export async function fetchDiscordUser(
  accessToken: string,
): Promise<DiscordUser> {
  const res = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Discord user fetch failed (${res.status})`);
  return (await res.json()) as DiscordUser;
}

// Discord's CDN path for a user's avatar, or null when they have none (the UI
// then falls back to an uploaded picture or a monogram).
export function discordAvatarUrl(d: DiscordUser): string | null {
  if (!d.avatar) return null;
  const ext = d.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${d.id}/${d.avatar}.${ext}?size=128`;
}

// Derive a valid CivCentral username (3-20 of [a-zA-Z0-9_]) from a Discord
// identity, then make it unique.
function sanitizeUsername(d: DiscordUser): string {
  const raw = (d.global_name || d.username || "user").toLowerCase();
  let s = raw.replace(/[^a-z0-9_]/g, "");
  if (s.length < 3) s = `user${s}`;
  return s.slice(0, 20) || "user";
}

async function uniqueUsername(d: DiscordUser): Promise<string> {
  const base = sanitizeUsername(d);
  if (!(await prisma.user.findUnique({ where: { username: base } }))) return base;
  for (let i = 0; i < 12; i++) {
    const suffix = Math.floor(1000 + Math.random() * 9000).toString();
    const candidate = `${base.slice(0, 20 - suffix.length)}${suffix}`;
    if (!(await prisma.user.findUnique({ where: { username: candidate } })))
      return candidate;
  }
  return `user${Date.now().toString().slice(-8)}`;
}

function profileFields(d: DiscordUser) {
  return {
    discordId: d.id,
    discordUsername: d.global_name || d.username || null,
    discordAvatar: discordAvatarUrl(d),
  };
}

// Resolve the account for a Discord identity, creating one if needed.
//
// SECURITY — automatic linking by email is a pre-hijacking sink. If we linked
// whenever Discord reported a verified address, an attacker could register a
// password account on the victim's address, never verify it, and wait: the
// victim's first Discord sign-in would drop them into the attacker's account,
// which still holds the attacker's known password.
//
// So an address only links two accounts when BOTH sides have proved they
// control it: Discord says verified AND the local account already verified it.
// An unverified local holder is treated as a squatter — their claim on the
// address is released (matching what register() does) and the Discord user
// gets a separate, fresh account.
export async function upsertDiscordUser(d: DiscordUser) {
  const existing = await prisma.user.findUnique({ where: { discordId: d.id } });
  if (existing) {
    // Keep the cached Discord profile fresh on every sign-in.
    return prisma.user.update({
      where: { id: existing.id },
      data: profileFields(d),
    });
  }

  const email = d.email ? normalizeEmail(d.email) : "";
  const discordVerified = !!email && d.verified === true;

  if (discordVerified) {
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      if (byEmail.emailVerified) {
        // Both sides verified this address. Linking is safe.
        if (byEmail.discordId && byEmail.discordId !== d.id) {
          throw new DiscordLinkError(
            "That email already belongs to an account with a different Discord linked.",
          );
        }
        return prisma.user.update({
          where: { id: byEmail.id },
          data: profileFields(d),
        });
      }
      // Squatter: never proved control. Release the address so the
      // Discord-verified owner can claim it.
      await prisma.user.update({
        where: { id: byEmail.id },
        data: { email: null },
      });
    }
  }

  try {
    return await prisma.user.create({
      data: {
        username: await uniqueUsername(d),
        ...profileFields(d),
        email: discordVerified ? email : null,
        emailVerified: discordVerified,
        role: "contributor",
        trusted: false,
      },
    });
  } catch {
    // Rare username/email race - retry once with a generated username and no
    // email, so the sign-in still completes.
    return prisma.user.create({
      data: {
        username: `user${Date.now().toString().slice(-8)}`,
        ...profileFields(d),
        role: "contributor",
        trusted: false,
      },
    });
  }
}

// Attach a Discord identity to an already-authenticated account. This is the
// explicit path from account settings, so no email guessing is involved: the
// user proved who they are by being logged in.
export async function linkDiscordToUser(userId: string, d: DiscordUser) {
  const taken = await prisma.user.findUnique({ where: { discordId: d.id } });
  if (taken && taken.id !== userId) {
    throw new DiscordLinkError(
      "That Discord account is already linked to another CivCentral account.",
    );
  }
  return prisma.user.update({
    where: { id: userId },
    data: profileFields(d),
  });
}
