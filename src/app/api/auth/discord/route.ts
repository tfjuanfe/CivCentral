import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { isDiscordConfigured, discordAuthorizeUrl } from "@/lib/discord";

export const dynamic = "force-dynamic";

// Start the Discord OAuth flow: set a short-lived state cookie (CSRF guard) and
// remember where to return, then redirect to Discord's consent screen.
export async function GET(req: NextRequest) {
  if (!isDiscordConfigured()) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent("Discord sign-in isn't configured yet.")}`,
        req.url,
      ),
    );
  }

  const rawNext = req.nextUrl.searchParams.get("next") || "/";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";
  const state = randomBytes(16).toString("hex");
  const secure = process.env.NODE_ENV === "production";

  const res = NextResponse.redirect(discordAuthorizeUrl(state));
  res.cookies.set("discord_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 600,
  });
  res.cookies.set("discord_oauth_next", next, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 600,
  });
  return res;
}
