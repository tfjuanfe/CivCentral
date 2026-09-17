"use client";

import { useId, useState } from "react";
import { IMAGE_ACCEPT, MEDIA_ACCEPT, mediaError } from "@/lib/media";

export default function MediaUpload({ purpose = "media", onUploaded, onBusyChange, disabled = false }: {
  purpose?: "avatar" | "media";
  onUploaded: (url: string, name: string) => void;
  onBusyChange?: (busy: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  async function upload(file: File) {
    const problem = mediaError(file.size, file.type, purpose === "avatar");
    if (problem) { setError(true); setMessage(problem); return; }
    setBusy(true); onBusyChange?.(true); setError(false); setMessage("Uploading…");
    const metadata = async (body: object) => {
      const res = await fetch("/api/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.headers.get("content-type")?.includes("application/json")) throw new Error("Upload service unavailable. Please try again.");
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Upload failed.");
      return result;
    };
    try {
      const start = await metadata({ action: "start", purpose, type: file.type, size: file.size });
      const put = await fetch(start.uploadUrl, {
        method: "PUT", headers: { "Content-Type": "application/octet-stream", "Content-Disposition": "attachment" }, body: file,
      });
      if (!put.ok) throw new Error("Could not upload the file. Please try again.");
      setMessage("Checking file…");
      const result = await metadata({ action: "complete", purpose, key: start.key });
      onUploaded(result.url, file.name);
      setMessage(purpose === "avatar" ? "Profile picture updated." : "Media uploaded and attached.");
    } catch (err) {
      setError(true); setMessage(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally { setBusy(false); onBusyChange?.(false); }
  }
  return <div className="media-upload">
    <label htmlFor={id}>{purpose === "avatar" ? "Upload a profile picture" : "Upload media from your device"}</label>
    <input id={id} type="file" accept={purpose === "avatar" ? IMAGE_ACCEPT : MEDIA_ACCEPT} disabled={disabled || busy}
      aria-describedby={`${id}-hint`} onChange={e => {
        const file = e.target.files?.[0]; e.target.value = "";
        if (file) void upload(file);
      }} />
    <p className="hint" id={`${id}-hint`}>{purpose === "avatar" ? "PNG, JPEG, WebP, or GIF" : "PNG, JPEG, WebP, GIF, MP4, WebM, MP3, Ogg, or WAV"}. Maximum 10 MB per file. Uploaded media is public.</p>
    {message && <p role={error ? "alert" : "status"} className={error ? "alert alert-error" : "hint"}>{message}</p>}
  </div>;
}
