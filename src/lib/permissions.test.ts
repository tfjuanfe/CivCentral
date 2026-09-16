import { describe, it, expect } from "vitest";
import {
  resolveSubmissionStatus,
  canEditEntry,
  canContributeNow,
  canManageEvent,
  canSeeEventRatings,
  canParticipateInEvent,
} from "./permissions";
import type { SessionUser } from "./types";

function user(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: "u1",
    username: "tester",
    role: "contributor",
    trusted: false,
    emailVerified: true,
    ...overrides,
  } as SessionUser;
}

describe("resolveSubmissionStatus", () => {
  it("parks anything saved as a draft", () => {
    expect(resolveSubmissionStatus(user(), "account", true)).toBe("draft");
    expect(
      resolveSubmissionStatus(user({ role: "archivist" }), "record", true),
    ).toBe("draft");
  });

  it("publishes archivist submissions directly", () => {
    expect(
      resolveSubmissionStatus(user({ role: "archivist" }), "record", false),
    ).toBe("published");
  });

  it("always routes RECORD entries through review", () => {
    expect(
      resolveSubmissionStatus(user({ trusted: true }), "record", false),
    ).toBe("pending");
  });

  it("auto-publishes ACCOUNT entries only for trusted contributors", () => {
    expect(
      resolveSubmissionStatus(user({ trusted: true }), "account", false),
    ).toBe("published");
    expect(
      resolveSubmissionStatus(user({ trusted: false }), "account", false),
    ).toBe("pending");
  });
});

describe("canEditEntry", () => {
  it("rejects anonymous users", () => {
    expect(canEditEntry(null, { authorId: "u1" })).toBe(false);
  });
  it("lets authors edit their own entries", () => {
    expect(canEditEntry(user({ id: "u1" }), { authorId: "u1" })).toBe(true);
    expect(canEditEntry(user({ id: "u1" }), { authorId: "u2" })).toBe(false);
  });
  it("lets archivists edit anything", () => {
    expect(
      canEditEntry(user({ id: "u1", role: "archivist" }), { authorId: "u2" }),
    ).toBe(true);
  });
});

describe("canContributeNow", () => {
  it("requires a verified email", () => {
    expect(canContributeNow(user({ emailVerified: true }))).toBe(true);
    expect(canContributeNow(user({ emailVerified: false }))).toBe(false);
  });
  it("rejects non-contributors", () => {
    expect(canContributeNow(user({ role: "reader" as any }))).toBe(false);
    expect(canContributeNow(null)).toBe(false);
  });
});

describe("suspension gating", () => {
  const banned = user({ suspended: true, status: "banned" });

  it("blocks contributing, editing, and participation while suspended", () => {
    expect(canContributeNow(banned)).toBe(false);
    expect(canEditEntry(banned, { authorId: "u1" })).toBe(false);
    expect(
      canParticipateInEvent(banned, { ratingMode: "open" }, "rate events").ok,
    ).toBe(false);
  });

  it("leaves an unsuspended account alone", () => {
    expect(canContributeNow(user())).toBe(true);
    expect(canEditEntry(user(), { authorId: "u1" })).toBe(true);
  });
});

describe("canManageEvent", () => {
  it("admits the owner and any archivist, nobody else", () => {
    expect(canManageEvent(user({ id: "u1" }), { ownerId: "u1" })).toBe(true);
    expect(canManageEvent(user({ id: "u2" }), { ownerId: "u1" })).toBe(false);
    expect(
      canManageEvent(user({ id: "u2", role: "archivist" }), { ownerId: "u1" }),
    ).toBe(true);
  });

  it("leaves an unowned event to archivists", () => {
    expect(canManageEvent(user({ id: "u1" }), { ownerId: null })).toBe(false);
    expect(
      canManageEvent(user({ role: "archivist" }), { ownerId: null }),
    ).toBe(true);
  });
});

describe("canSeeEventRatings", () => {
  const publicEvent = {
    ownerId: "u9",
    ratingsEnabled: true,
    ratingsPublic: true,
  };
  const privateEvent = { ...publicEvent, ratingsPublic: false };

  it("shows a public score to everyone, including logged-out readers", () => {
    expect(canSeeEventRatings(null, publicEvent)).toBe(true);
  });

  it("hides a private score from ordinary members but not the owner", () => {
    expect(canSeeEventRatings(user({ id: "u1" }), privateEvent)).toBe(false);
    expect(canSeeEventRatings(user({ id: "u9" }), privateEvent)).toBe(true);
    expect(
      canSeeEventRatings(user({ id: "u1", role: "archivist" }), privateEvent),
    ).toBe(true);
  });

  it("hides the score entirely when ratings are switched off", () => {
    const off = { ...publicEvent, ratingsEnabled: false };
    expect(canSeeEventRatings(user({ id: "u1" }), off)).toBe(false);
    expect(canSeeEventRatings(user({ id: "u9" }), off)).toBe(true);
  });
});

describe("canParticipateInEvent", () => {
  it("requires a verified email only when the host asks for one", () => {
    const unverified = user({ emailVerified: false });
    expect(canParticipateInEvent(unverified, { ratingMode: "open" }, "x").ok).toBe(
      true,
    );
    expect(
      canParticipateInEvent(unverified, { ratingMode: "verified" }, "x").ok,
    ).toBe(false);
  });

  it("always requires a login", () => {
    expect(canParticipateInEvent(null, { ratingMode: "open" }, "x").ok).toBe(
      false,
    );
  });
});
