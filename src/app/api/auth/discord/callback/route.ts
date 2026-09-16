import { NextRequest, NextResponse } from "next/server";
import {
  exchangeDiscordCode,
  fetchDiscordUser,
  upsertDiscordUser,
} from "@/lib/discord";
import { sessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Handle Discord's redirect back: verify the state, exchange the code, resolve
// the account, and set the session cookie on the redirect response.
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("discord_oauth_state")?.value;
  const rawNext = req.cookies.get("discord_oauth_next")?.value || "/";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const fail = (msg: string) => {
    const r = NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(msg)}`, req.url),
    );
    r.cookies.delete("discord_oauth_state");
    r.cookies.delete("discord_oauth_next");
    return r;
  };

  if (url.searchParams.get("error")) return fail("Discord sign-in was cancelled.");
  if (!code || !state || !cookieState || state !== cookieState) {
    return fail("Discord sign-in could not be verified. Please try again.");
  }

  try {
    const accessToken = await exchangeDiscordCode(code);
    const discordUser = await fetchDiscordUser(accessToken);
    if (!discordUser?.id) return fail("Discord did not return an account.");

    const user = await upsertDiscordUser(discordUser);

    const res = NextResponse.redirect(new URL(next, req.url));
    const c = await sessionCookie(user.id);
    res.cookies.set(c.name, c.value, c.options);
    res.cookies.delete("discord_oauth_state");
    res.cookies.delete("discord_oauth_next");
    return res;
  } catch (err) {
    console.error("[discord] callback failed:", err);
    return fail("Could not complete Discord sign-in. Please try again.");
  }
}
