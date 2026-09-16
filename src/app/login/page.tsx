import AuthForm from "@/components/AuthForm";
import { isDiscordConfigured } from "@/lib/discord";

export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string };
}) {
  return (
    <>
      <h1 className="page-title">Log in</h1>
      <p className="lede">Log in to contribute records and accounts.</p>
      {searchParams.error && (
        <div className="alert alert-error" style={{ maxWidth: 420 }}>
          {searchParams.error}
        </div>
      )}
      <AuthForm
        mode="login"
        next={searchParams.next ?? "/"}
        discordEnabled={isDiscordConfigured()}
      />
    </>
  );
}
