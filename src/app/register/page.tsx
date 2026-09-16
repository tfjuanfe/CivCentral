import AuthForm from "@/components/AuthForm";
import { isDiscordConfigured } from "@/lib/discord";
import { safeRedirectPath } from "@/lib/validation";
import { getBaseUrl } from "@/lib/email";

export const dynamic = "force-dynamic";

export default function RegisterPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  const next = safeRedirectPath(searchParams.next, getBaseUrl());

  return (
    <>
      <h1 className="page-title">Create an account</h1>
      <p className="lede">
        New contributors start untrusted: your submissions go to the review queue
        until an archivist marks you trusted. Record entries are always reviewed.
      </p>
      {searchParams.error && (
        <div className="alert alert-error form-narrow">{searchParams.error}</div>
      )}
      <AuthForm
        mode="register"
        next={next}
        discordEnabled={isDiscordConfigured()}
      />
    </>
  );
}
