import AuthForm from "@/components/AuthForm";
import { isDiscordConfigured } from "@/lib/discord";

export const dynamic = "force-dynamic";

export default function RegisterPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  return (
    <>
      <h1 className="page-title">Create an account</h1>
      <p className="lede">
        New contributors start untrusted: your submissions go to the review queue
        until an archivist marks you trusted. Record entries are always reviewed.
      </p>
      <AuthForm
        mode="register"
        next={searchParams.next ?? "/"}
        discordEnabled={isDiscordConfigured()}
      />
    </>
  );
}
