import Link from "next/link";
import type { Metadata } from "next";
import { LEGAL, RETENTION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy | WikiCiv",
  description:
    "What personal data WikiCiv collects, why, how long it is kept, and how to get it removed.",
};

export default function PrivacyPage() {
  return (
    <article className="legal-doc">
      <nav className="breadcrumbs">
        <Link href="/">Home</Link> / Privacy Policy
      </nav>

      <h1 className="page-title">Privacy Policy</h1>
      <p className="muted">Last updated: {LEGAL.lastUpdated}</p>

      <p className="lede">
        WikiCiv is a community archive of Minecraft civilization roleplay. To run
        it we have to store a small amount of information about you — chiefly an
        email address and a password. This page says exactly what we hold, why we
        hold it, who can see it, and how to get it back or get rid of it.
      </p>

      <h2 className="section-title">
        <span className="cube-bullet" aria-hidden /> Who is responsible
      </h2>
      <p>
        This archive is operated by <strong>{LEGAL.operator}</strong>
        {LEGAL.jurisdiction ? ` in ${LEGAL.jurisdiction}` : ""}, who act as the
        data controller for everything described here.{" "}
        {LEGAL.contactEmail ? (
          <>
            Privacy questions and requests go to{" "}
            <a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a>.
          </>
        ) : (
          <>
            Privacy questions and requests go to an archivist — see the{" "}
            <Link href="/faq">FAQ</Link> for how to reach the team.
          </>
        )}
      </p>

      <h2 className="section-title">
        <span className="cube-bullet" aria-hidden /> What we collect, and why
      </h2>

      <h3>Your account</h3>
      <ul>
        <li>
          <strong>Username.</strong> Required, public. It is shown on everything
          you submit. Pick one that isn&apos;t your real name if you&apos;d
          rather not be identifiable.
        </li>
        <li>
          <strong>Email address.</strong> Optional to register, required to
          contribute. We use it for one thing: sending you a verification link
          that proves the address is yours, which is how we keep the review queue
          free of throwaway spam accounts. Your email is{" "}
          <strong>never shown publicly</strong> and never sold, rented, or shared
          with advertisers.
        </li>
        <li>
          <strong>Password.</strong> Stored only as a bcrypt hash. We cannot read
          your password, recover it, or tell you what it was — and neither can
          anyone who gets hold of the database. Never reuse a password you use
          elsewhere.
        </li>
        <li>
          <strong>Discord account ID.</strong> Only if you choose &ldquo;Continue
          with Discord&rdquo;. We store the numeric ID that links your Discord
          identity to your WikiCiv account, and the email address Discord gives
          us if it has already verified it. We do not receive or store your
          Discord password.
        </li>
        <li>
          <strong>Bio.</strong> Optional, public, and entirely up to you.
        </li>
      </ul>

      <h3>What you post</h3>
      <p>
        Entries, revisions, comments, comment votes, event ratings, and stars are
        stored against your account and, apart from your individual vote and
        rating, are public. Revision history is kept deliberately: an archive
        that can be silently rewritten is not an archive.
      </p>

      <h3>Technical data</h3>
      <ul>
        <li>
          <strong>Session cookie.</strong> One cookie,{" "}
          <code>wikiciv_session</code>, holding a signed token that says which
          account you are. It is strictly necessary to keep you logged in, so it
          is set without a consent banner. It carries no tracking identifier.
        </li>
        <li>
          <strong>Theme preference.</strong> Kept in your browser&apos;s local
          storage. It never reaches our servers.
        </li>
        <li>
          <strong>Rate-limit counters.</strong> We store short-lived counters
          keyed by IP address to stop sign-up, login, comment, and report floods.
          They expire within the hour.
        </li>
        <li>
          <strong>No analytics, no advertising, no third-party trackers.</strong>{" "}
          We do not profile you and there is no automated decision-making.
        </li>
      </ul>

      <h3>Moderation data</h3>
      <p>
        If you report a comment or an entry, we store the report with your
        username, the reason you picked, anything you wrote, and a snapshot of
        the reported content. Reports are visible to archivists only — never to
        the person you reported. If your account is suspended we store the
        reason, the length, and which archivist did it; you are shown the reason.
      </p>

      <h2 className="section-title">
        <span className="cube-bullet" aria-hidden /> Our legal basis
      </h2>
      <ul>
        <li>
          <strong>Contract.</strong> Running the account you asked us to create.
        </li>
        <li>
          <strong>Consent.</strong> Sending verification email to the address you
          gave us. You can withdraw it by removing your email or deleting your
          account.
        </li>
        <li>
          <strong>Legitimate interests.</strong> Keeping the archive usable and
          free of abuse — rate limiting, moderation, reports, and the moderation
          log.
        </li>
      </ul>

      <h2 className="section-title">
        <span className="cube-bullet" aria-hidden /> Who else sees it
      </h2>
      <p>
        We use a small number of processors, and nothing beyond what they need:
      </p>
      <ul>
        <li>
          <strong>Our hosting and database provider</strong> stores the data that
          makes the site work.
        </li>
        <li>
          <strong>Resend</strong> receives your email address solely to deliver
          verification messages.
        </li>
        <li>
          <strong>Discord</strong>, only if you sign in with it, and only as part
          of that sign-in.
        </li>
      </ul>
      <p>
        Beyond that we disclose personal data only when the law requires it. We
        do not sell it under any circumstances.
      </p>

      <h2 className="section-title">
        <span className="cube-bullet" aria-hidden /> How long we keep it
      </h2>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Data</th>
              <th>Retention</th>
            </tr>
          </thead>
          <tbody>
            {RETENTION.map((row) => (
              <tr key={row.what}>
                <td>{row.what}</td>
                <td>{row.how_long}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="section-title">
        <span className="cube-bullet" aria-hidden /> Your rights
      </h2>
      <p>
        Wherever you live, we will honour these; if you are in the UK, EU, or
        EEA, the GDPR gives them to you outright.
      </p>
      <ul>
        <li>
          <strong>Access.</strong> Ask for a copy of what we hold about you.
        </li>
        <li>
          <strong>Correction.</strong> Fix your username, email, or bio from your
          profile at any time.
        </li>
        <li>
          <strong>Deletion.</strong> Ask us to delete your account. We will
          remove your account record, email, password hash, and Discord link.
        </li>
        <li>
          <strong>Objection and restriction.</strong> Tell us to stop processing
          your data for a given purpose, and we will unless we have an overriding
          reason — which, for a community wiki, is usually just abuse prevention.
        </li>
        <li>
          <strong>Portability.</strong> Every entry can be exported as Markdown
          from its own page, and we can supply the rest on request.
        </li>
        <li>
          <strong>Complaint.</strong> If we handle this badly you can complain to
          your local data protection authority.
        </li>
      </ul>

      <h3>What deletion does not remove</h3>
      <p>
        Deleting your account does not automatically retract the lore you
        contributed. Entries, revisions, and comments may be kept so that the
        archive and its history stay coherent for everyone else who worked on
        them — but tell us and we will anonymise your authorship or remove
        specific posts. The moderation log also survives account deletion: it
        records what archivists did, which is precisely the record that has to
        outlast the content.
      </p>

      <h2 className="section-title">
        <span className="cube-bullet" aria-hidden /> Security
      </h2>
      <p>
        Passwords are bcrypt-hashed. Session tokens are signed and set{" "}
        <code>HttpOnly</code>, <code>SameSite=Lax</code>, and (in production)
        <code> Secure</code>, so scripts on the page cannot read them. Email
        verification links are stored only as hashes and expire. Traffic runs
        over HTTPS. No system is perfect: if we ever discover a breach affecting
        your data we will tell you and the relevant authority without undue
        delay.
      </p>

      <h2 className="section-title">
        <span className="cube-bullet" aria-hidden /> Age
      </h2>
      <p>
        You must be at least {LEGAL.minimumAge} to hold an account. If we learn
        that an account belongs to someone younger, we delete it.
      </p>

      <h2 className="section-title">
        <span className="cube-bullet" aria-hidden /> Changes
      </h2>
      <p>
        If we change this policy in a way that affects you, we will say so on the
        site rather than quietly swapping the text. The date at the top always
        reflects the current version.
      </p>

      <p className="muted" style={{ marginTop: 28 }}>
        See also the <Link href="/legal/terms">Terms of Use</Link>.
      </p>
    </article>
  );
}
