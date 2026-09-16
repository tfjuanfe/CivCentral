"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changePassword, deleteAccount, unlinkDiscord } from "@/app/actions/profile";
import Icon from "./Icon";

type Msg = { ok: boolean; text: string } | null;

export interface DiscordLink {
  linked: boolean;
  username: string | null;
}

// `hasPassword` is false for accounts created through Discord sign-in. Those
// are setting a first password rather than changing one, so there is no current
// password to ask for.
function ChangePassword({ hasPassword }: { hasPassword: boolean }) {
  const [pending, start] = useTransition();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<Msg>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (next.length < 8) {
      setMsg({ ok: false, text: "New password must be at least 8 characters." });
      return;
    }
    if (next !== confirm) {
      setMsg({ ok: false, text: "New passwords don't match." });
      return;
    }
    start(async () => {
      const res = await changePassword(current, next);
      if (!res.ok) {
        setMsg({ ok: false, text: res.error });
        return;
      }
      setMsg({
        ok: true,
        text: hasPassword
          ? "Password changed."
          : "Password set. You can now log in with your username too.",
      });
      setCurrent("");
      setNext("");
      setConfirm("");
    });
  }

  return (
    <section className="card" style={{ marginBottom: 20 }}>
      <h2 className="section-title" style={{ marginTop: 0 }}>
        <span className="cube-bullet" aria-hidden />{" "}
        {hasPassword ? "Change password" : "Set a password"}
      </h2>

      {!hasPassword && (
        <p className="muted" style={{ margin: "0 0 10px" }}>
          You signed up with Discord, so this account has no password yet.
          Setting one gives you a second way in — and it&apos;s required before
          you can unlink Discord.
        </p>
      )}

      {msg && (
        <div
          className={`alert ${msg.ok ? "alert-success" : "alert-error"}`}
          style={{ margin: "8px 0" }}
        >
          {msg.text}
        </div>
      )}

      <form className="field" style={{ maxWidth: 360 }} onSubmit={submit}>
        {hasPassword && (
          <>
            <label htmlFor="cp-current">Current password</label>
            <input
              id="cp-current"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </>
        )}
        <label htmlFor="cp-next" style={{ marginTop: 10 }}>
          New password
        </label>
        <input
          id="cp-next"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <label htmlFor="cp-confirm" style={{ marginTop: 10 }}>
          Confirm new password
        </label>
        <input
          id="cp-confirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
        <div className="btn-row" style={{ marginTop: 12 }}>
          <button
            className="btn btn-sm"
            type="submit"
            disabled={
              pending || (hasPassword && !current) || !next || !confirm
            }
          >
            {pending ? "…" : hasPassword ? "Update password" : "Set password"}
          </button>
        </div>
      </form>
    </section>
  );
}

// Link / unlink the Discord identity. Linking is a full OAuth round trip, so
// it's a plain link to the initiation endpoint rather than a server action.
function Connections({
  discord,
  hasPassword,
}: {
  discord: DiscordLink;
  hasPassword: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);

  // Unlinking a passwordless account would remove the only way in, so the
  // server refuses it. Disable the button too, and say why.
  const canUnlink = discord.linked && hasPassword;

  function unlink() {
    if (
      !window.confirm(
        "Unlink Discord from this account? You'll log in with your username and password instead.",
      )
    )
      return;
    setMsg(null);
    start(async () => {
      const res = await unlinkDiscord();
      if (!res.ok) {
        setMsg({ ok: false, text: res.error });
        return;
      }
      setMsg({ ok: true, text: "Discord unlinked." });
      router.refresh();
    });
  }

  return (
    <section className="card" style={{ marginBottom: 20 }}>
      <h2 className="section-title" style={{ marginTop: 0 }}>
        <span className="cube-bullet" aria-hidden /> Connections
      </h2>

      {msg && (
        <div
          className={`alert ${msg.ok ? "alert-success" : "alert-error"}`}
          style={{ margin: "8px 0" }}
        >
          {msg.text}
        </div>
      )}

      <div className="connection-row">
        <div>
          <strong>Discord</strong>
          <p className="muted" style={{ margin: "2px 0 0" }}>
            {discord.linked ? (
              <>
                Linked
                {discord.username ? (
                  <>
                    {" as "}
                    <strong>{discord.username}</strong>
                  </>
                ) : null}
                . You can sign in with Discord.
              </>
            ) : (
              "Not linked. Link it to sign in with one click."
            )}
          </p>
          {discord.linked && !hasPassword && (
            <p className="hint" style={{ margin: "4px 0 0" }}>
              Set a password above before unlinking — Discord is currently the
              only way into this account.
            </p>
          )}
        </div>

        {discord.linked ? (
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={unlink}
            disabled={pending || !canUnlink}
            title={
              canUnlink ? undefined : "Set a password first"
            }
          >
            {pending ? "…" : "Unlink"}
          </button>
        ) : (
          <a
            href="/api/auth/discord?mode=link&next=/me"
            className="btn btn-sm discord-btn"
          >
            Link Discord
          </a>
        )}
      </div>
    </section>
  );
}

function DeleteAccount({ hasPassword }: { hasPassword: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await deleteAccount(password, confirm);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/");
      router.refresh();
    });
  }

  return (
    <section className="card" style={{ borderLeft: "5px solid var(--disputed)" }}>
      <h2 className="section-title" style={{ marginTop: 0 }}>
        <span className="cube-bullet" aria-hidden /> Delete account
      </h2>
      <p className="muted" style={{ margin: "0 0 10px" }}>
        This is permanent. Your email and login are removed and you&apos;re signed
        out. Anything you&apos;ve published stays in the archive, but it&apos;s no
        longer linked to a usable account.
      </p>

      {!open ? (
        <button
          type="button"
          className="btn btn-sm btn-danger"
          onClick={() => setOpen(true)}
        >
          <Icon name="warning" className="inline-ico" /> Delete my account
        </button>
      ) : (
        <form className="field" style={{ maxWidth: 360 }} onSubmit={submit}>
          {error && (
            <div className="alert alert-error" style={{ margin: "0 0 8px" }}>
              {error}
            </div>
          )}
          {hasPassword && (
            <>
              <label htmlFor="da-password">Confirm your password</label>
              <input
                id="da-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </>
          )}
          <label htmlFor="da-confirm" style={{ marginTop: 10 }}>
            Type <strong>DELETE</strong> to confirm
          </label>
          <input
            id="da-confirm"
            type="text"
            autoComplete="off"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="DELETE"
          />
          <div className="btn-row" style={{ marginTop: 12 }}>
            <button
              className="btn btn-sm btn-danger"
              type="submit"
              disabled={
                pending || (hasPassword && !password) || confirm !== "DELETE"
              }
            >
              {pending ? "…" : "Permanently delete"}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => {
                setOpen(false);
                setPassword("");
                setConfirm("");
                setError(null);
              }}
              disabled={pending}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

export default function AccountSettings({
  hasPassword = true,
  discord = { linked: false, username: null },
  discordEnabled = false,
}: {
  hasPassword?: boolean;
  discord?: DiscordLink;
  discordEnabled?: boolean;
}) {
  return (
    <>
      <ChangePassword hasPassword={hasPassword} />
      {(discordEnabled || discord.linked) && (
        <Connections discord={discord} hasPassword={hasPassword} />
      )}
      <DeleteAccount hasPassword={hasPassword} />
    </>
  );
}
