import Link from "next/link";
import Icon from "@/components/Icon";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatDate, formatDateTime } from "@/lib/format";
import type { EntryType, Layer } from "@/lib/types";
import { TypeBadge, LayerBadge, StatusBadge, DisputedTag } from "@/components/Badges";
import EmailVerification from "@/components/EmailVerification";
import AccountSettings from "@/components/AccountSettings";
import { isDiscordConfigured } from "@/lib/discord";
import AvatarEditor from "@/components/AvatarEditor";
import ContributionBadge from "@/components/ContributionBadge";
import { canContributeNow } from "@/lib/permissions";

export const dynamic = "force-dynamic";

type MyEntry = {
  id: string;
  name: string;
  type: string;
  layer: string;
  status: string;
  disputed: boolean;
  reviewFeedback: string | null;
  reviewFeedbackAt: Date | null;
  updatedAt: Date;
  event: { id: string; name: string };
};

function EntryRow({ e }: { e: MyEntry }) {
  return (
    <article className="card entry-card">
      <div className="entry-card-head">
        <TypeBadge type={e.type as EntryType} />
        <LayerBadge layer={e.layer as Layer} />
        <StatusBadge status={e.status as any} />
        {e.disputed && <DisputedTag />}
      </div>
      <h3 style={{ margin: "2px 0" }}>
        <Link href={`/entries/${e.id}`}>{e.name}</Link>
      </h3>
      <div className="entry-card-foot">
        <span>in {e.event.name}</span>
        <span>updated {formatDate(e.updatedAt)}</span>
      </div>
      {e.status === "draft" && e.reviewFeedback && (
        <div className="alert alert-error" style={{ margin: "8px 0 0" }}>
          <strong>Changes requested</strong>
          {e.reviewFeedbackAt ? ` · ${formatDateTime(e.reviewFeedbackAt)}` : ""}:
          <br />
          {e.reviewFeedback}
        </div>
      )}
      <div className="btn-row" style={{ marginTop: 10 }}>
        <Link href={`/entries/${e.id}`} className="btn btn-sm btn-secondary">
          View
        </Link>
        <Link href={`/entries/${e.id}/edit`} className="btn btn-sm btn-secondary">
          Edit
        </Link>
        <Link
          href={`/entries/${e.id}/history`}
          className="btn btn-sm btn-secondary"
        >
          History
        </Link>
      </div>
    </article>
  );
}

function Section({
  title,
  hint,
  items,
}: {
  title: string;
  hint: string;
  items: MyEntry[];
}) {
  return (
    <section style={{ marginBottom: 8 }}>
      <h2 className="section-title">
        <span className="cube-bullet" aria-hidden /> {title} ({items.length})
      </h2>
      {items.length === 0 ? (
        <p className="muted" style={{ marginTop: -4 }}>
          {hint}
        </p>
      ) : (
        <div className="card-grid">
          {items.map((e) => (
            <EntryRow key={e.id} e={e} />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function MyContributionsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/me");

  const [entries, account] = await Promise.all([
    prisma.entry.findMany({
      where: { authorId: user.id },
      include: { event: { select: { id: true, name: true } } },
      orderBy: { updatedAt: "desc" },
    }) as unknown as Promise<MyEntry[]>,
    // Account settings need to know whether this account has a password at all
    // and whether Discord is attached, so it can offer "set a password" instead
    // of "change password" and refuse to strip the only way in.
    prisma.user.findUnique({
      where: { id: user.id },
      select: {
        passwordHash: true,
        discordId: true,
        discordUsername: true,
      },
    }),
  ]);

  const drafts = entries.filter((e) => e.status === "draft");
  const pending = entries.filter((e) => e.status === "pending");
  const published = entries.filter((e) => e.status === "published");
  const needsAttention = drafts.filter((e) => e.reviewFeedback);
  const profile = await prisma.user.findUnique({ where: { id: user.id }, select: { avatarUrl: true } });

  return (
    <>
      <h1 className="page-title">My Contributions</h1>
      <p className="lede">
        Everything you’ve submitted, in one place. {published.length} published ·{" "}
        {pending.length} awaiting review · {drafts.length} draft
        {drafts.length === 1 ? "" : "s"}.
      </p>

      <EmailVerification email={user.email} verified={user.emailVerified} />
      <section className="card" style={{ marginBlock: 20 }}>
        <h2 className="section-title">Contributor progress</h2>
        <ContributionBadge count={published.length} showProgress />
        <Link href={`/users/${user.username}`}>View your public profile</Link>
      </section>
      <AvatarEditor username={user.username} initialValue={profile?.avatarUrl ?? null} canUpload={canContributeNow(user)} />

      {needsAttention.length > 0 && (
        <div className="card" style={{ borderLeft: "5px solid var(--disputed)" }}>
          <strong>
            <Icon name="warning" className="inline-ico" />{" "}
            {needsAttention.length} entr
            {needsAttention.length === 1 ? "y" : "ies"} need your attention
          </strong>
          <p className="muted" style={{ margin: "4px 0 8px" }}>
            An archivist sent these back with feedback. Edit and resubmit.
          </p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {needsAttention.map((e) => (
              <li key={e.id}>
                <Link href={`/entries/${e.id}/edit`}>{e.name}</Link>:{" "}
                <span className="muted">{e.reviewFeedback}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 20 }}>
          You haven’t submitted anything yet.{" "}
          <Link href="/entries/new">Add your first entry</Link>.
        </div>
      ) : (
        <>
          <Section
            title="Drafts"
            hint="No drafts. Work you save as a draft, or that's sent back for changes, lands here."
            items={drafts}
          />
          <Section
            title="Awaiting review"
            hint="Nothing is waiting on an archivist right now."
            items={pending}
          />
          <Section
            title="Published"
            hint="Nothing published yet."
            items={published}
          />
        </>
      )}

      <AccountSettings
        hasPassword={!!account?.passwordHash}
        discordEnabled={isDiscordConfigured()}
        discord={{
          linked: !!account?.discordId,
          username: account?.discordUsername ?? null,
        }}
      />
    </>
  );
}
