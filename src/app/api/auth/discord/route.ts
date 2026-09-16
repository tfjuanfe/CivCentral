import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { discordAuthorizeUrl, isDiscordConfigured } from "@/lib/discord";
import { safeRedirectPath } from "@/lib/validation";

export const dynamic = "force-dynamic";

const STATE_MAX_AGE = 10 * 60; // the round trip should take seconds, not hours

// Start the Discord OAuth2 flow.
//
// `next` is where to land afterwards and `mode=link` means "attach Discord to
// the account that is already signed in" rather than "sign in". Both are
// stashed in short-lived HttpOnly cookies so the callback can trust them; the
// redirect target is sanitized HERE as well as in the callback, so an
// off-origin value is never persisted in the first place.
export async function GET(req: NextRequest) {
  if (!isDiscordConfigured()) {
    return NextResponse.redirect(
      new URL("/login?error=Discord+sign-in+is+not+configured.", req.url),
    );
  }

  const next = safeRedirectPath(req.nextUrl.searchParams.get("next"), req.url);
  const mode = req.nextUrl.searchParams.get("mode") === "link" ? "link" : "login";

  // CSRF: a random value echoed back by Discord and compared to the cookie.
  const state = randomBytes(32).toString("hex");

  const res = NextResponse.redirect(discordAuthorizeUrl(state));
  const options = {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: STATE_MAX_AGE,
  };
  res.cookies.set("discord_oauth_state", state, options);
  res.cookies.set("discord_oauth_next", next, options);
  res.cookies.set("discord_oauth_mode", mode, options);
  return res;
}
