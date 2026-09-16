// One policy for the browser, upload authorization and server-side validation.
export const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
export const MEDIA_TYPES: Record<string, string> = {
  "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif",
  "video/mp4": "mp4", "video/webm": "webm",
  "audio/mpeg": "mp3", "audio/ogg": "ogg", "audio/wav": "wav",
};
export const IMAGE_ACCEPT = Object.keys(MEDIA_TYPES).filter(t => t.startsWith("image/")).join(",");
export const MEDIA_ACCEPT = Object.keys(MEDIA_TYPES).join(",");

export function mediaError(size: number, type: string, imagesOnly = false): string | null {
  if (!Number.isSafeInteger(size) || size <= 0) return "Choose a non-empty file.";
  if (size > MAX_MEDIA_BYTES) return "File is too large (10 MB max).";
  if (!Object.hasOwn(MEDIA_TYPES, type) || (imagesOnly && !type.startsWith("image/")))
    return imagesOnly ? "Choose a PNG, JPEG, WebP, or GIF image." : "Choose a PNG, JPEG, WebP, GIF, MP4, WebM, MP3, Ogg, or WAV file.";
  return null;
}

// Reject mislabeled HTML/SVG/executables. This is signature validation, not a
// malware scan or a guarantee that a browser can decode every media codec.
export function matchesMediaSignature(bytes: Uint8Array, type: string): boolean {
  const at = (offset: number, value: string) => [...value].every((c, i) => bytes[offset + i] === c.charCodeAt(0));
  if (bytes.length < 12) return false;
  switch (type) {
    case "image/png": return at(0, "\x89PNG\r\n\x1a\n") && at(12, "IHDR");
    case "image/jpeg": return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/gif": return at(0, "GIF87a") || at(0, "GIF89a");
    case "image/webp": return at(0, "RIFF") && at(8, "WEBP");
    case "video/mp4": return at(4, "ftyp") && ["isom", "iso2", "mp41", "mp42", "avc1", "M4V ", "dash"].some(brand => at(8, brand));
    case "video/webm": return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3 && new TextDecoder().decode(bytes.slice(0, 4096)).includes("webm");
    case "audio/mpeg": return at(0, "ID3") || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0 && (bytes[1] & 0x06) !== 0);
    case "audio/ogg": return at(0, "OggS");
    case "audio/wav": return at(0, "RIFF") && at(8, "WAVE");
    default: return false;
  }
}

export function mediaKind(url: string): "image" | "video" | "audio" | "link" {
  let path: string;
  try { path = new URL(url).pathname.toLowerCase(); } catch { return "link"; }
  if (/\.(png|jpe?g|webp|gif)$/.test(path)) return "image";
  if (/\.(mp4|webm)$/.test(path)) return "video";
  if (/\.(mp3|ogg|wav)$/.test(path)) return "audio";
  return "link";
}
