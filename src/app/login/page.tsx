import AuthForm from "@/components/AuthForm";
import { isDiscordConfigured } from "@/lib/discord";
import { safeRedirectPath } from "@/lib/validation";
import { getBaseUrl } from "@/lib/email";

export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  // Same guard as the OAuth flow: a "next" arriving on the URL is attacker
  // input until it has been proven same-origin.
  const next = safeRedirectPath(searchParams.next, getBaseUrl());

  return (
    <>
      <h1 className="page-title">Log in</h1>
      <p className="lede">Log in to contribute records and accounts.</p>
      {searchParams.error && (
        <div className="alert alert-error form-narrow">{searchParams.error}</div>
      )}
      <AuthForm
        mode="login"
        next={next}
        discordEnabled={isDiscordConfigured()}
      />
    </>
  );
}
