import Link from "next/link";
import type { Metadata } from "next";
import { LEGAL, PROCESSORS, RETENTION } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy | CivCentral",
  description:
    "What personal data CivCentral collects, why, how long it is kept, and how to get it removed.",
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
        CivCentral is a community hub for Minecraft civilization events. To run
        it we store a small amount of information about you — chiefly an email
        address and a password. This page says exactly what we hold, why, who
        can see it, and how to get it back or get rid of it.
      </p>

      <h2 className="section-title">
        <span className="cube-bullet" aria-hidden /> Who is responsible
      </h2>
      <p>
        CivCentral is operated by <strong>{LEGAL.operator}</strong>
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
          <strong>Username.</strong> Required, public. It appears on everything
          you submit. Pick one that isn&apos;t your real name if you&apos;d
          rather not be identifiable.
        </li>
        <li>
          <strong>Email address.</strong> Optional to register, required to
          contribute. We use it for one thing: sending a verification link that
          proves the address is yours, which keeps the review queue free of
          throwaway spam accounts. It is <strong>never shown publicly</strong>{" "}
          and never sold, rented, or shared with advertisers.
        </li>
        <li>
          <strong>Password.</strong> Stored only as a bcrypt hash. We cannot
          read it, recover it, or tell you what it was — and neither can anyone
          who obtains the database. Never reuse a password from elsewhere.
        </li>
        <li>
          <strong>Discord account.</strong> Only if you sign in with Discord or
          link it later. We store your Discord user ID, display handle, and
          avatar URL so the account can be matched on future sign-ins. We never
          receive your Discord password. You can unlink it at any time from your
          account settings, once you have set a password.
        </li>
        <li>
          <strong>Profile picture and bio.</strong> Optional, public, and
          entirely up to you. Uploaded images are held in object storage.
        </li>
      </ul>

      <h3>What you post</h3>
      <p>
        Entries, revisions, evidence links, comments, votes, event ratings, and
        stars are stored against your account. Apart from your individual vote
        and rating, they are public. Revision history is kept deliberately: an
        archive that can be silently rewritten is not an archive.
      </p>

      <h3>Hosting and requests</h3>
      <p>
        If you ask to become an event host, or propose a server or event, we
        keep that request, its outcome, and any note the reviewing archivist
        left — so a decision can be explained later rather than being a shrug.
        If you opt in to hear about a server&apos;s new events, we store that
        interest so the Discord bot can notify you.
      </p>

      <h3>Technical data</h3>
      <ul>
        <li>
          <strong>Session cookie.</strong> One cookie holding a signed token
          that says which account you are. It is strictly necessary to keep you
          logged in, so it is set without a consent banner, and it carries no
          tracking identifier.
        </li>
        <li>
          <strong>Theme preference.</strong> Kept in your browser&apos;s local
          storage. It never reaches our servers.
        </li>
        <li>
          <strong>Rate-limit counters.</strong> Short-lived counters keyed by IP
          address, used to stop sign-up, login, comment, and report floods.
        </li>
        <li>
          <strong>
            No analytics, no advertising, no third-party trackers.
          </strong>{" "}
          We do not profile you, and there is no automated decision-making.
        </li>
      </ul>

      <h3>Moderation data</h3>
      <p>
        If you report content or another member, we store the report with your
        account, the reason, and anything you wrote. Reports are visible to
        archivists only — never to the person you reported. If your account is
        suspended or banned we store that status, when it lifts, and the
        archivist&apos;s action in the moderation log.
      </p>

      <h2 className="section-title">
        <span className="cube-bullet" aria-hidden /> Our legal basis
      </h2>
      <ul>
        <li>
          <strong>Contract.</strong> Running the account you asked us to create.
        </li>
        <li>
          <strong>Consent.</strong> Sending verification email to the address
          you gave us, and Discord notifications you opted into. Withdraw either
          by removing the address, opting out, or deleting the account.
        </li>
        <li>
          <strong>Legitimate interests.</strong> Keeping the site usable and
          free of abuse — rate limiting, moderation, reports, and the moderation
          log.
        </li>
      </ul>

      <h2 className="section-title">
        <span className="cube-bullet" aria-hidden /> Who else sees it
      </h2>
      <p>We use a small number of processors, and share nothing beyond what each one needs:</p>
      <ul>
        {PROCESSORS.map((p) => (
          <li key={p.name}>
            <strong>{p.name}</strong> — {p.why}
          </li>
        ))}
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
      <p className="muted" style={{ fontSize: "0.85rem" }}>
        Where a row says data is cleared &ldquo;opportunistically&rdquo; rather
        than on a schedule, that is a deliberately honest description of how the
        cleanup actually runs — we would rather state the real behaviour than
        promise a bound the code does not enforce.
      </p>

      <h2 className="section-title">
        <span className="cube-bullet" aria-hidden /> Your rights
      </h2>
      <p>
        Wherever you live we will honour these; if you are in the UK, EU, or
        EEA, the GDPR gives them to you outright.
      </p>
      <ul>
        <li>
          <strong>Access.</strong> Ask for a copy of what we hold about you.
        </li>
        <li>
          <strong>Correction.</strong> Change your email, avatar, or bio from
          your account settings at any time.
        </li>
        <li>
          <strong>Deletion.</strong> Delete your account from account settings.
          We remove your email, password hash, Discord link, and avatar.
        </li>
        <li>
          <strong>Objection and restriction.</strong> Tell us to stop processing
          your data for a given purpose, and we will unless we have an
          overriding reason — which, for a community site, is usually just abuse
          prevention.
        </li>
        <li>
          <strong>Portability.</strong> Every entry can be exported as Markdown
          from its own page, and we can supply the rest on request.
        </li>
        <li>
          <strong>Complaint.</strong> If we handle this badly you can complain
          to your local data protection authority.
        </li>
      </ul>

      <h3>What deletion does not remove</h3>
      <p>
        If you never published anything, deleting your account removes the
        record outright. If you did publish, we keep the row but strip
        everything that identifies you — username replaced, email, password,
        Discord link and avatar cleared — so the entries, revisions and
        discussions other people built on stay coherent. Tell us and we will
        also remove specific posts.
      </p>
      <p>
        The moderation log survives account deletion. It stores names rather
        than account links precisely so it can outlive the content it describes;
        it is the record of what archivists did, which is the part that has to
        remain checkable.
      </p>

      <h2 className="section-title">
        <span className="cube-bullet" aria-hidden /> Security
      </h2>
      <p>
        Passwords are bcrypt-hashed. Session tokens are signed and set{" "}
        <code>HttpOnly</code>, <code>SameSite=Lax</code>, and, in production,{" "}
        <code>Secure</code>, so page scripts cannot read them. Verification
        links are stored only as hashes and expire. Discord sign-in only links
        an existing account when both sides have verified the same email
        address, so nobody can claim your account by registering on your address
        first. Traffic runs over HTTPS.
      </p>
      <p>
        No system is perfect. If we discover a breach affecting your data we
        will tell you and the relevant authority without undue delay.
      </p>

      <h2 className="section-title">
        <span className="cube-bullet" aria-hidden /> Age
      </h2>
      <p>
        You must be at least {LEGAL.minimumAge} to hold an account. If we learn
        an account belongs to someone younger, we delete it.
      </p>

      <h2 className="section-title">
        <span className="cube-bullet" aria-hidden /> Changes
      </h2>
      <p>
        If we change this policy in a way that affects you, we will say so on
        the site rather than quietly swapping the text. The date at the top
        always reflects the current version.
      </p>

      <p className="muted" style={{ marginTop: 28 }}>
        See also the <Link href="/legal/terms">Terms of Use</Link>.
      </p>
    </article>
  );
}
