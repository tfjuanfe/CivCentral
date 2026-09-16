"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { safeRedirect } from "@/lib/validation";
import { login, register } from "@/app/actions/auth";

export default function AuthForm({
  mode,
  next,
  // The button only appears when the server has Discord credentials set, so a
  // half-configured deployment doesn't offer a flow that can only fail.
  discordEnabled = false,
}: {
  mode: "login" | "register";
  next: string;
  discordEnabled?: boolean;
}) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res =
      mode === "login"
        ? await login(username, password)
        : await register(username, password, email || undefined);
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    router.push(safeRedirect(next));
    router.refresh();
  }

  return (
    <div className="form-narrow">
      {discordEnabled && (
        <div className="oauth-block">
          <a
            href={`/api/auth/discord?next=${encodeURIComponent(next || "/")}`}
            className="btn discord-btn oauth-btn"
          >
            <DiscordMark /> Continue with Discord
          </a>
          <div className="oauth-divider">
            <span />
            or {mode === "login" ? "log in" : "sign up"} with a username
            <span />
          </div>
        </div>
      )}

      <form onSubmit={onSubmit}>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="field">
        <label htmlFor="username">Username</label>
        <input
          id="username"
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />
      </div>
      {mode === "register" && (
        <div className="field">
          <label htmlFor="email">
            Email <span className="muted">(optional, needed to contribute)</span>
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <p className="muted" style={{ fontSize: "0.8rem", margin: "4px 0 0" }}>
            We&apos;ll send a verification link. You can browse without one, but a
            verified email is required to add records or accounts.
          </p>
        </div>
      )}
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="btn-row">
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "…" : mode === "login" ? "Log in" : "Create account"}
        </button>
        {mode === "login" ? (
          <span className="muted">
            New here? <Link href="/register">Sign up</Link>
          </span>
        ) : (
          <span className="muted">
            Have an account? <Link href="/login">Log in</Link>
          </span>
        )}
      </div>
      </form>
    </div>
  );
}

// Inline so the button needs no network request and no icon-set entry.
function DiscordMark() {
  return (
    <svg
      viewBox="0 0 24 18"
      width="20"
      height="15"
      aria-hidden
      fill="currentColor"
    >
      <path d="M20.3 1.6A19.8 19.8 0 0 0 15.4.1a14 14 0 0 0-.6 1.3 18.3 18.3 0 0 0-5.5 0A14 14 0 0 0 8.6.1 19.7 19.7 0 0 0 3.7 1.6C.6 6.2-.2 10.7.2 15.1a19.9 19.9 0 0 0 6 3 14.9 14.9 0 0 0 1.3-2.1 12.9 12.9 0 0 1-2-1c.2-.1.3-.2.5-.4a14.2 14.2 0 0 0 12.1 0l.5.4a12.9 12.9 0 0 1-2 1 14.7 14.7 0 0 0 1.3 2.1 19.8 19.8 0 0 0 6-3c.5-5.1-.8-9.6-3.6-13.5ZM8.0 12.4c-1.2 0-2.1-1.1-2.1-2.4S6.8 7.6 8 7.6s2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4Zm8 0c-1.2 0-2.1-1.1-2.1-2.4s.9-2.4 2.1-2.4 2.2 1.1 2.1 2.4c0 1.3-.9 2.4-2.1 2.4Z" />
    </svg>
  );
}
