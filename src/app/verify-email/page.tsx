import Link from "next/link";
import ConfirmEmailButton from "@/components/ConfirmEmailButton";

export const dynamic = "force-dynamic";

// A confirm page (not a bare GET handler) so that email link-scanners and
// prefetchers don't silently consume the single-use token. The actual
// verification happens when the user clicks the button, which POSTs to a
// server action.
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const token = (await searchParams).token ?? "";

  if (!token) {
    return (
      <>
        <h1 className="page-title">Verify your email</h1>
        <div className="alert alert-error">
          This link is missing its verification token. Request a new email from
          your <Link href="/me">My Contributions</Link> page.
        </div>
      </>
    );
  }

  return (
    <>
      <h1 className="page-title">Verify your email</h1>
      <p className="lede">
        Click below to confirm your email and unlock contributing.
      </p>
      <ConfirmEmailButton token={token} />
    </>
  );
}
