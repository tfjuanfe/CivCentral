import AuthForm from "@/components/AuthForm";
import { isDiscordConfigured } from "@/lib/discord";
import { safeRedirectPath } from "@/lib/validation";
import { getBaseUrl } from "@/lib/email";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeRedirectPath(params.next, getBaseUrl());

  return (
    <>
      <h1 className="page-title">Create an account</h1>
      <p className="lede">
        New contributors start untrusted: your submissions go to the review queue
        until an archivist marks you trusted. Record entries are always reviewed.
      </p>
      {params.error && (
        <div className="alert alert-error form-narrow">{params.error}</div>
      )}
      <AuthForm
        mode="register"
        next={next}
        discordEnabled={isDiscordConfigured()}
      />
    </>
  );
}
