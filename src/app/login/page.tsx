import AuthForm from "@/components/AuthForm";
import { isDiscordConfigured } from "@/lib/discord";
import { safeRedirectPath } from "@/lib/validation";
import { getBaseUrl } from "@/lib/email";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  // Same guard as the OAuth flow: a "next" arriving on the URL is attacker
  // input until it has been proven same-origin.
  const next = safeRedirectPath(params.next, getBaseUrl());

  return (
    <>
      <h1 className="page-title">Log in</h1>
      <p className="lede">Log in to contribute records and accounts.</p>
      {params.error && (
        <div className="alert alert-error form-narrow">{params.error}</div>
      )}
      <AuthForm
        mode="login"
        next={next}
        discordEnabled={isDiscordConfigured()}
      />
    </>
  );
}
