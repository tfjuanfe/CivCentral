import { mediaKind } from "@/lib/media";

export default function MediaPreview({ url, caption }: { url: string; caption: string }) {
  const kind = mediaKind(url);
  if (kind === "video") return <video className="uploaded-media" src={url} controls preload="metadata" aria-label={caption} />;
  if (kind === "audio") return <audio className="uploaded-media" src={url} controls preload="metadata" aria-label={caption} />;
  if (kind === "image") return <img className="uploaded-media" src={url} alt={caption} loading="lazy" />;
  return null;
}
