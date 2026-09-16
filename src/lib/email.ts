import "server-only";
import { Resend } from "resend";

// Basic, permissive email shape check. We rely on actual deliverability +
// verification for correctness, not a perfect regex.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value) && value.length <= 254;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

// Origin used to build absolute links in emails. Prefer an explicit env var;
// fall back to the incoming request's forwarded host (works on Vercel).
export function getBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicit) {
    const url = new URL(explicit);
    if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:"))
      throw new Error("NEXT_PUBLIC_APP_URL must use HTTPS in production.");
    return url.origin;
  }
  // Never construct verification links from attacker-controlled Host headers.
  return process.env.NODE_ENV === "production" ? "https://wikiciv.xyz" : "http://localhost:3000";
}

const FROM = process.env.EMAIL_FROM?.trim() || "CivCentral <noreply@civcentral.com>";

// Send the verification email. Returns ok=false (rather than throwing) so
// callers can surface a friendly message. If RESEND_API_KEY is unset we log the
// link to the server console instead — keeps local dev usable without a key.
export async function sendVerificationEmail(
  to: string,
  link: string,
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") return { ok: false, error: "Email delivery is not configured. Please try again later." };
    console.log(`[email] (no RESEND_API_KEY) verification link for ${to}:\n${link}`);
    return { ok: true };
  }

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM,
      to,
      subject: "Verify your CivCentral email",
      text: verificationText(link),
      html: verificationHtml(link),
    });
    if (error) {
      console.error("[email] Resend error:", error);
      return { ok: false, error: "Could not send the verification email." };
    }
    return { ok: true };
  } catch (err) {
    console.error("[email] send failed:", err);
    return { ok: false, error: "Could not send the verification email." };
  }
}

function verificationText(link: string): string {
  return [
    "Welcome to CivCentral!",
    "",
    "Confirm your email to start contributing records and accounts:",
    link,
    "",
    "This link expires in 24 hours. If you didn't request it, you can ignore this email.",
  ].join("\n");
}

function verificationHtml(link: string): string {
  return `
  <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;color:#1a1a1a">
    <h2 style="margin:0 0 12px">Verify your CivCentral email</h2>
    <p style="margin:0 0 16px;line-height:1.5">
      Confirm your email to start contributing records and accounts to the archive.
    </p>
    <p style="margin:0 0 20px">
      <a href="${link}" style="display:inline-block;background:#3b5b3b;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none">
        Verify email
      </a>
    </p>
    <p style="margin:0;color:#666;font-size:13px;line-height:1.5">
      This link expires in 24 hours. If you didn't request it, you can safely ignore this email.
    </p>
  </div>`;
}
