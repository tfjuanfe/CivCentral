import "server-only";
import { prisma } from "./db";
import { getBaseUrl } from "./email";

// Discord OAuth2 (Authorization Code grant). The token exchange and profile
// fetch happen server-side, so the strict CSP (connect-src 'self') never sees
// discord.com — only the top-level browser redirects do.

export interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
  email?: string | null;
  verified?: boolean;
  avatar?: string | null;
}

export function isDiscordConfigured(): boolean {
  return !!(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET);
}

// The redirect URI must match exactly what's registered in the Discord app.
// Prefer an explicit env var; otherwise derive it from the request host.
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
    prompt: "consent",
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

export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser> {
  const res = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Discord user fetch failed (${res.status})`);
  return (await res.json()) as DiscordUser;
}

// Derive a valid CivCentral username (3–20 of [a-zA-Z0-9_]) from a Discord
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

// Find the account for a Discord identity, or create one. Links to an existing
// account only when Discord has *verified* the same email (both sides proved
// control of that address).
export async function upsertDiscordUser(d: DiscordUser) {
  const existing = await prisma.user.findUnique({ where: { discordId: d.id } });
  if (existing) return existing;

  const email = d.email ? d.email.trim().toLowerCase() : null;
  const emailVerified = !!email && d.verified === true;

  if (email && emailVerified) {
    const byEmail = await prisma.user.findUnique({ where: { email } });
    if (byEmail && !byEmail.discordId) {
      return prisma.user.update({
        where: { id: byEmail.id },
        data: { discordId: d.id, emailVerified: true },
      });
    }
  }

  const emailFree =
    !!email && !(await prisma.user.findUnique({ where: { email } }));

  try {
    return await prisma.user.create({
      data: {
        username: await uniqueUsername(d),
        discordId: d.id,
        email: emailFree ? email : null,
        emailVerified: emailFree ? emailVerified : false,
        role: "contributor",
        trusted: false,
        // The sign-in button states that continuing accepts the Terms and
        // Privacy Policy, so record consent at account creation.
        termsAcceptedAt: new Date(),
      },
    });
  } catch {
    // Rare username/discordId race — retry once with a fresh username.
    return prisma.user.create({
      data: {
        username: `user${Date.now().toString().slice(-8)}`,
        discordId: d.id,
        role: "contributor",
        trusted: false,
        termsAcceptedAt: new Date(),
      },
    });
  }
}
