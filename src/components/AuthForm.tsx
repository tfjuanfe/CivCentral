"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { login, register } from "@/app/actions/auth";

export default function AuthForm({
  mode,
  next,
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
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res =
      mode === "login"
        ? await login(username, password)
        : await register(username, password, email || undefined, accepted);
    if (!res.ok) {
      setError(res.error);
      setBusy(false);
      return;
    }
    router.push(next || "/");
    router.refresh();
  }

  return (
    <div className="form-narrow">
      {discordEnabled && (
        <div style={{ marginBottom: 18 }}>
          <a
            href={`/api/auth/discord?next=${encodeURIComponent(next || "/")}`}
            className="btn discord-btn"
            style={{ width: "100%", justifyContent: "center" }}
          >
            Continue with Discord
          </a>
          {mode === "register" && (
            <p className="hint" style={{ margin: "8px 0 0" }}>
              By continuing with Discord you agree to the{" "}
              <Link href="/legal/terms" target="_blank">
                Terms of Use
              </Link>{" "}
              and{" "}
              <Link href="/legal/privacy" target="_blank">
                Privacy Policy
              </Link>
              .
            </p>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              marginTop: 16,
              color: "var(--text-muted)",
              fontSize: "0.82rem",
            }}
          >
            <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
            or {mode === "login" ? "log in" : "sign up"} with a username
            <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
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
              Email <span className="muted">(optional — needed to contribute)</span>
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
        {mode === "register" && (
          <div className="field consent-field">
            <label className="consent-label">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              <span>
                I have read and agree to the{" "}
                <Link href="/legal/terms" target="_blank">
                  Terms of Use
                </Link>{" "}
                and the{" "}
                <Link href="/legal/privacy" target="_blank">
                  Privacy Policy
                </Link>
                , including how WikiCiv stores and uses my email address.
              </span>
            </label>
          </div>
        )}

        <div className="btn-row">
          <button
            className="btn"
            type="submit"
            disabled={busy || (mode === "register" && !accepted)}
          >
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
