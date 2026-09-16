import Link from "next/link";
import Icon from "@/components/Icon";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import EntryCard from "@/components/EntryCard";
import ProfileBioEditor from "@/components/ProfileBioEditor";
import Avatar from "@/components/Avatar";
import AvatarEditor from "@/components/AvatarEditor";
import ContributionBadge from "@/components/ContributionBadge";
import { canContributeNow } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  return { title: `${(await params).username} | CivCentral` };
}

const ROLE_LABEL: Record<string, string> = {
  archivist: "Archivist",
  contributor: "Contributor",
  reader: "Reader",
};

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const profile = await prisma.user.findFirst({
    where: { username: { equals: (await params).username, mode: "insensitive" } },
    select: {
      id: true,
      username: true,
      role: true,
      trusted: true,
      eventHost: true,
      bio: true,
      avatarUrl: true,
      createdAt: true,
    },
  });
  if (!profile) notFound();

  const [entries, total, viewer] = await Promise.all([
    prisma.entry.findMany({
      where: { authorId: profile.id, status: "published" },
      include: {
        author: { select: { username: true } },
        event: { select: { server: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.entry.count({
      where: { authorId: profile.id, status: "published" },
    }),
    getCurrentUser(),
  ]);

  const isOwner = viewer?.id === profile.id;

  return (
    <>
      <nav className="breadcrumbs">
        <Link href="/">Home</Link> / Profiles / {profile.username}
      </nav>

      <div className="profile-head">
        <Avatar username={profile.username} value={profile.avatarUrl} />
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>
            {profile.username}
            {profile.trusted && (
              <span className="trusted-dot" title="trusted contributor">
                {" "}
                <Icon name="sparkle" />
              </span>
            )}
          </h1>
          <div className="tag-row" style={{ marginTop: 6 }}>
            <span className="badge badge-type">
              {ROLE_LABEL[profile.role] ?? "Contributor"}
            </span>
            {profile.eventHost && (
              <span className="badge badge-layer layer-record">Event Host</span>
            )}
            <span className="muted">
              {total} published contribution{total === 1 ? "" : "s"}
            </span>
            <span className="muted">Joined {formatDate(profile.createdAt)}</span>
            <ContributionBadge count={total} />
          </div>
        </div>
      </div>

      {isOwner && <AvatarEditor username={profile.username} initialValue={profile.avatarUrl} canUpload={canContributeNow(viewer)} />}

      <h2 className="section-title">
        <span className="cube-bullet" aria-hidden /> About
      </h2>
      {isOwner ? (
        <ProfileBioEditor initialBio={profile.bio} />
      ) : profile.bio ? (
        <p className="profile-bio">{profile.bio}</p>
      ) : (
        <p className="muted">This contributor hasn&apos;t written a bio yet.</p>
      )}

      <h2 className="section-title">
        <span className="cube-bullet" aria-hidden /> Published contributions
      </h2>
      {entries.length === 0 ? (
        <div className="empty-state">No published contributions yet.</div>
      ) : (
        <>
          <div className="card-grid">
            {entries.map((e) => (
              <EntryCard key={e.id} entry={e} />
            ))}
          </div>
          {total > entries.length && (
            <p className="muted" style={{ marginTop: 12 }}>
              Showing the {entries.length} most recent of {total}.
            </p>
          )}
        </>
      )}
    </>
  );
}
