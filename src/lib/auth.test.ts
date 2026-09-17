import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";

const mocks = vi.hoisted(() => ({ token: "", row: null as Record<string, unknown> | null, set: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({
  get: () => mocks.token ? { value: mocks.token } : undefined,
  set: (_name: string, value: string, options: unknown) => { mocks.token = value; mocks.set(options); },
  delete: () => { mocks.token = ""; },
}) }));
vi.mock("./db", () => ({ prisma: { user: { findUnique: async () => mocks.row } } }));
import { createSession, destroySession, getCurrentUser } from "./auth";

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("AUTH_SECRET", "test-only-secret-not-for-production-1234567890");
  mocks.token = "";
  mocks.set.mockReset();
  mocks.row = { id: "u1", username: "alice", passwordHash: "stored-password-hash", status: "active", suspendedUntil: null, role: "contributor", trusted: false, eventHost: false, email: "alice@example.test", emailVerified: true };
});

describe("signed session enforcement", () => {
  it("round-trips a session without exposing the password hash to the client", async () => {
    await createSession("u1");
    expect(await getCurrentUser()).toMatchObject({ id: "u1", username: "alice" });
    expect(await getCurrentUser()).not.toHaveProperty("passwordHash");
    expect(mocks.token).not.toContain("stored-password-hash");
    expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ httpOnly: true, sameSite: "lax" }));
  });
  it("rejects the old cookie immediately after a password change", async () => {
    await createSession("u1");
    mocks.row!.passwordHash = "changed-password-hash";
    expect(await getCurrentUser()).toBeNull();
    await createSession("u1");
    expect(await getCurrentUser()).toMatchObject({ id: "u1" });
  });
  it("rejects banned or removed accounts while exposing suspension state", async () => {
    await createSession("u1");
    mocks.row!.status = "banned";
    expect(await getCurrentUser()).toBeNull();
    mocks.row!.status = "suspended";
    expect(await getCurrentUser()).toMatchObject({ suspended: true });
    mocks.row = null;
    expect(await getCurrentUser()).toBeNull();
  });
  it("rejects signed legacy cookies without a password version", async () => {
    mocks.token = await new SignJWT({ uid: "u1" }).setProtectedHeader({ alg: "HS256" }).setExpirationTime("1h")
      .sign(new TextEncoder().encode(process.env.AUTH_SECRET));
    expect(await getCurrentUser()).toBeNull();
  });
  it("destroys the current cookie", async () => {
    await createSession("u1");
    await destroySession();
    expect(await getCurrentUser()).toBeNull();
  });
});
