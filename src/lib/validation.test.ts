import { describe, it, expect } from "vitest";
import { safeRedirectPath, SAFE_REDIRECT_FALLBACK, discordError } from "./validation";

const BASE = "https://civcentral.example";

describe("safeRedirectPath", () => {
  it("keeps ordinary same-origin paths, with query and hash", () => {
    expect(safeRedirectPath("/me", BASE)).toBe("/me");
    expect(safeRedirectPath("/events/abc?tab=lore", BASE)).toBe(
      "/events/abc?tab=lore",
    );
    expect(safeRedirectPath("/search?q=a#top", BASE)).toBe("/search?q=a#top");
  });

  it("falls back for empty or missing values", () => {
    expect(safeRedirectPath(null, BASE)).toBe(SAFE_REDIRECT_FALLBACK);
    expect(safeRedirectPath(undefined, BASE)).toBe(SAFE_REDIRECT_FALLBACK);
    expect(safeRedirectPath("   ", BASE)).toBe(SAFE_REDIRECT_FALLBACK);
  });

  it("rejects protocol-relative and absolute off-origin URLs", () => {
    expect(safeRedirectPath("//attacker.example", BASE)).toBe(
      SAFE_REDIRECT_FALLBACK,
    );
    expect(safeRedirectPath("https://attacker.example/x", BASE)).toBe(
      SAFE_REDIRECT_FALLBACK,
    );
    expect(safeRedirectPath("http://attacker.example", BASE)).toBe(
      SAFE_REDIRECT_FALLBACK,
    );
  });

  // The regression this helper exists for: a backslash passes a naive
  // startsWith("/") && !startsWith("//") check, but the URL parser normalizes
  // it into a protocol-relative URL pointing off-origin.
  it("rejects backslash-smuggled open redirects", () => {
    for (const evil of [
      "/\\attacker.example",
      "/\\\\attacker.example",
      "\\/attacker.example",
      "/foo\\@attacker.example",
    ]) {
      expect(safeRedirectPath(evil, BASE)).toBe(SAFE_REDIRECT_FALLBACK);
    }
  });

  it("rejects control characters browsers would strip before parsing", () => {
    expect(safeRedirectPath("/\tattacker", BASE)).toBe(SAFE_REDIRECT_FALLBACK);
    expect(safeRedirectPath("/\nattacker", BASE)).toBe(SAFE_REDIRECT_FALLBACK);
    expect(safeRedirectPath("/\r\n/attacker.example", BASE)).toBe(
      SAFE_REDIRECT_FALLBACK,
    );
    expect(safeRedirectPath("/%00", BASE)).toBe("/%00"); // encoded, inert
  });

  it("rejects non-path schemes", () => {
    expect(safeRedirectPath("javascript:alert(1)", BASE)).toBe(
      SAFE_REDIRECT_FALLBACK,
    );
    expect(safeRedirectPath("data:text/html,x", BASE)).toBe(
      SAFE_REDIRECT_FALLBACK,
    );
    expect(safeRedirectPath("mailto:a@b.c", BASE)).toBe(SAFE_REDIRECT_FALLBACK);
  });

  it("falls back when the base itself is unparseable", () => {
    expect(safeRedirectPath("/me", "not-a-url")).toBe(SAFE_REDIRECT_FALLBACK);
  });
});

describe("discordError", () => {
  it("requires a link only when the caller says it is required", () => {
    expect(discordError("", true)).toBeTruthy();
    expect(discordError("", false)).toBeNull();
  });
  it("accepts http(s) links and rejects other schemes", () => {
    expect(discordError("https://discord.gg/abc", false)).toBeNull();
    expect(discordError("discord.gg/abc", false)).toBeTruthy();
  });
});
