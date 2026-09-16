import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import {
  DiscordLinkError,
  exchangeDiscordCode,
  fetchDiscordUser,
  isDiscordConfigured,
  linkDiscordToUser,
  upsertDiscordUser,
} from "@/lib/discord";
import { getCurrentUser, sessionCookie } from "@/lib/auth";
import { safeRedirectPath } from "@/lib/validation";

export const dynamic = "force-dynamic";

const STATE_COOKIES = [
  "discord_oauth_state",
  "discord_oauth_next",
  "discord_oauth_mode",
];

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

// Handle Discord's redirect back: verify the state, exchange the code, resolve
// or link the account, and set the session cookie on the redirect response.
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("discord_oauth_state")?.value;
  const mode = req.cookies.get("discord_oauth_mode")?.value === "link"
    ? "link"
    : "login";

  // Re-sanitize on the way out. The initiation endpoint already cleaned this,
  // but the cookie is the attacker-adjacent part of the flow and a bare
  // prefix check would let "/\attacker.example" through as a protocol-relative
  // URL once new URL() normalizes the backslash.
  const next = safeRedirectPath(
    req.cookies.get("discord_oauth_next")?.value,
    req.url,
  );

  const clearState = (res: NextResponse) => {
    for (const name of STATE_COOKIES) res.cookies.delete(name);
    return res;
  };

  const fail = (msg: string, to = "/login") =>
    clearState(
      NextResponse.redirect(
        new URL(`${to}?error=${encodeURIComponent(msg)}`, req.url),
      ),
    );

  if (!isDiscordConfigured())
    return fail("Discord sign-in is not configured.");
  if (url.searchParams.get("error"))
    return fail("Discord sign-in was cancelled.");
  if (!code || !state || !cookieState || !constantTimeEqual(state, cookieState))
    return fail("Discord sign-in could not be verified. Please try again.");

  try {
    const accessToken = await exchangeDiscordCode(code);
    const discordUser = await fetchDiscordUser(accessToken);
    if (!discordUser?.id) return fail("Discord did not return an account.");

    if (mode === "link") {
      // Linking requires an existing session: we attach Discord to the account
      // that is already proven, never to one guessed from an email address.
      const current = await getCurrentUser();
      if (!current)
        return fail("Log in first, then link your Discord account.", "/login");

      await linkDiscordToUser(current.id, discordUser);
      return clearState(
        NextResponse.redirect(new URL("/me?linked=discord", req.url)),
      );
    }

    const user = await upsertDiscordUser(discordUser);

    const res = NextResponse.redirect(new URL(next, req.url));
    const c = await sessionCookie(user.id);
    res.cookies.set(c.name, c.value, c.options);
    return clearState(res);
  } catch (err) {
    if (err instanceof DiscordLinkError) {
      return fail(err.message, mode === "link" ? "/me" : "/login");
    }
    console.error("[discord] callback failed:", err);
    return fail("Could not complete Discord sign-in. Please try again.");
  }
}
