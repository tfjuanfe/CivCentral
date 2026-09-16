import Link from "next/link";
import type { Metadata } from "next";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Use | WikiCiv",
  description:
    "The rules for using WikiCiv: your account, what you post, moderation, reports, and suspensions.",
};

export default function TermsPage() {
  return (
    <article className="legal-doc">
      <nav className="breadcrumbs">
        <Link href="/">Home</Link> / Terms of Use
      </nav>

      <h1 className="page-title">Terms of Use</h1>
      <p className="muted">Last updated: {LEGAL.lastUpdated}</p>

      <p className="lede">
        WikiCiv is a community archive run by volunteers. These terms are the
        deal between you and {LEGAL.operator}: what you can expect from the
        archive, and what it expects from you. Creating an account means you
        accept them and the <Link href="/legal/privacy">Privacy Policy</Link>.
      </p>

      <h2 className="section-title">
        <span className="cube-bullet" aria-hidden /> Your account
      </h2>
      <ul>
        <li>
          You must be at least {LEGAL.minimumAge} years old.
        </li>
        <li>
          One account per person. Don&apos;t impersonate someone else, and
          don&apos;t create a second account to get around a suspension.
        </li>
        <li>
          You are responsible for what happens under your account. Use a password
          you don&apos;t use anywhere else, and tell an archivist if you think
          someone else has got into it.
        </li>
        <li>
          Contributing requires a verified email address. Individual event hosts
          may waive that on their own event pages, but it always applies to lore
          entries.
        </li>
      </ul>

      <h2 className="section-title">
        <span className="cube-bullet" aria-hidden /> What you post
      </h2>
      <p>
        You keep ownership of everything you write. By posting it here you give
        {" "}{LEGAL.operator} a non-exclusive, worldwide, royalty-free licence to
        store it, display it on the archive, and let other members build on it —
        which is the whole point of a wiki. You can withdraw specific posts;
        see <Link href="/legal/privacy">deletion</Link>.
      </p>
      <p>
        Post only what is yours to post. Screenshots of your own gameplay are
        fine. Someone else&apos;s builds, writing, or artwork are not, unless you
        have their permission or are properly crediting them.
      </p>

      <h3>Records and Accounts</h3>
      <p>
        The archive separates <strong>Records</strong> — what verifiably happened
        in-game, subject to review and evidence — from <strong>Accounts</strong>,
        the in-character stories players tell. Deliberately filing fiction as a
        Record wastes archivists&apos; time and is treated as a breach of these
        terms. Conflicting Records are marked disputed rather than deleted.
      </p>

      <h2 className="section-title">
        <span className="cube-bullet" aria-hidden /> Rules of conduct
      </h2>
      <p>Don&apos;t post, submit, or upload:</p>
      <ul>
        <li>
          Harassment, threats, or targeted abuse of another person. In-character
          conflict between factions is the point of the archive; out-of-character
          attacks on the player behind a faction are not.
        </li>
        <li>Hate speech, or content attacking people for who they are.</li>
        <li>Sexual content, or gratuitous real-world violence.</li>
        <li>
          Anyone&apos;s real-world personal information — names, addresses,
          workplaces, contact details — posted without their consent.
        </li>
        <li>Spam, advertising, or referral links.</li>
        <li>Malware, exploits, or anything designed to break the site.</li>
      </ul>
      <p>
        Also: don&apos;t scrape the archive at volume, don&apos;t try to evade
        rate limits, and don&apos;t attempt to access accounts or archivist tools
        that aren&apos;t yours.
      </p>

      <h2 className="section-title">
        <span className="cube-bullet" aria-hidden /> Event hosts
      </h2>
      <p>
        Each event may have a host, who can customize that event&apos;s page:
        switching ratings on or off, keeping the score private, opening or
        closing the discussion, and choosing whether a verified email is needed
        to take part. Hosts set the tone of their own page.
      </p>
      <p>
        Hosting does not confer moderation powers. Hosts cannot delete other
        members&apos; posts, see reports, or suspend anyone, and these terms
        apply on every event page regardless of how the host has configured it.
      </p>

      <h2 className="section-title">
        <span className="cube-bullet" aria-hidden /> Reports and moderation
      </h2>
      <p>
        Anyone logged in can report a comment or an entry. Reports go to the
        archivists, not to the author, and include a snapshot of the reported
        content so it can still be judged if it is later deleted. Don&apos;t file
        reports in bad faith — mass-reporting someone you are in conflict with is
        itself a breach.
      </p>
      <p>Archivists may, in response to a report or on their own initiative:</p>
      <ul>
        <li>delete a comment or an entry;</li>
        <li>send an entry back to its author with requested changes;</li>
        <li>mark conflicting Records as disputed;</li>
        <li>grant or revoke trusted status;</li>
        <li>
          suspend an account temporarily or permanently, blocking posting,
          voting, and reporting while browsing stays open.
        </li>
      </ul>
      <p>
        If you are suspended you are told the reason and the length. Archivist
        actions are written to a moderation log, so moderation is accountable
        rather than invisible. If you think a decision was wrong, contact an
        archivist and ask for it to be looked at again.
      </p>

      <h2 className="section-title">
        <span className="cube-bullet" aria-hidden /> Availability
      </h2>
      <p>
        The archive is provided as-is, by volunteers, with no guarantee of
        uptime, and no warranty express or implied. We may change or discontinue
        features. To the fullest extent the law allows, {LEGAL.operator} are not
        liable for indirect or consequential loss arising from your use of the
        site. Nothing here limits liability that cannot lawfully be limited.
      </p>
      <p>
        Keep your own copy of anything you would hate to lose. Every entry can be
        exported as Markdown from its page.
      </p>

      <h2 className="section-title">
        <span className="cube-bullet" aria-hidden /> Ending things
      </h2>
      <p>
        You can stop using the archive at any time and ask for your account to be
        deleted. We may suspend or close an account that repeatedly breaches
        these terms. The sections on what you post, availability, and liability
        survive closure.
      </p>

      <h2 className="section-title">
        <span className="cube-bullet" aria-hidden /> Changes and contact
      </h2>
      <p>
        We will announce material changes on the site rather than changing the
        text quietly.
        {LEGAL.jurisdiction
          ? ` These terms are governed by the law of ${LEGAL.jurisdiction}.`
          : ""}{" "}
        Questions go to the archivists — see the <Link href="/faq">FAQ</Link>.
      </p>

      <p className="muted" style={{ marginTop: 28 }}>
        WikiCiv is a fan project. It is not affiliated with, endorsed by, or
        connected to Mojang Studios or Microsoft. See also the{" "}
        <Link href="/legal/privacy">Privacy Policy</Link>.
      </p>
    </article>
  );
}
