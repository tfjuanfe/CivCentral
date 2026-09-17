"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PRESET_AVATARS } from "@/lib/avatars";
import { updateAvatar } from "@/app/actions/profile";
import Avatar from "./Avatar";
import MediaUpload from "./MediaUpload";

export default function AvatarEditor({ username, initialValue, canUpload }: { username: string; initialValue: string | null; canUpload: boolean }) {
  const router = useRouter();
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function choose(next: string | null) {
    setBusy(true); setMessage("");
    try {
      const result = await updateAvatar(next);
      if (!result.ok) { setMessage(result.error); return; }
      setValue(next); setMessage("Profile picture updated."); router.refresh();
    } catch { setMessage("Could not save your avatar. Please try again."); }
    finally { setBusy(false); }
  }
  return <section className="card avatar-editor">
    <h2 className="section-title">Profile picture</h2>
    <Avatar username={username} value={value} />
    <div className="avatar-options" role="group" aria-label="Preset avatars">
      {PRESET_AVATARS.map(p => <button key={p.id} type="button" className="avatar-option" disabled={busy}
        aria-pressed={value === `preset:${p.id}`} onClick={() => void choose(`preset:${p.id}`)}>
        <span style={{ background: p.color }} aria-hidden>{p.symbol}</span>{p.label}
      </button>)}
    </div>
    <button type="button" className="btn btn-sm btn-secondary" disabled={busy || !value} onClick={() => void choose(null)}>Use initials</button>
    {canUpload ? <MediaUpload purpose="avatar" disabled={busy} onBusyChange={setBusy} onUploaded={url => { setValue(url); router.refresh(); }} /> :
      <p className="hint">Verify your email to upload a custom profile picture. Preset avatars are available now.</p>}
    {message && <p role="status">{message}</p>}
  </section>;
}
