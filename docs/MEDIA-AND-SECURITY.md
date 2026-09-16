# Profile pictures, media, contributor badges, and security

## Features

- `/me` and your public profile let you select six preset avatars, restore initials, or upload a picture. Presets work without R2. Custom uploads require an active, email-verified contributor account.
- The article editor accepts device uploads in its body and, for Records, as evidence. Images: PNG, JPEG, WebP, GIF. Video: MP4, WebM. Audio: MP3, Ogg, WAV. The limit is **10 × 1024 × 1024 bytes per file**, enforced in both browser and server.
- Profiles show the highest earned badge at 5, 10, 15, 20, and every subsequent multiple of five **currently published authored articles**. `/me` shows progress to the next badge. Drafts, pending articles, and revisions do not inflate the count. Unpublishing or deleting an article updates progress automatically.

## Required deployment configuration

1. Use Node.js 22.12 or newer. This change updates Next.js to 15.5.25 and adapts its asynchronous request APIs. PostCSS is overridden to a patched compatible 8.x release.
2. Set `AUTH_SECRET` to a new deployment-specific random secret, at least 32 characters. The previously published deployment-guide value and development defaults are rejected. If that old value was ever used, rotate it in the hosting environment: deleting it from the guide does not remove it from Git history. Existing sessions must sign in again after this release because cookies are now bound to the stored password hash.
3. Set `NEXT_PUBLIC_APP_URL` to the canonical HTTPS origin. Verification links no longer trust incoming forwarded-host headers. Production email requires `RESEND_API_KEY`; verification links are never logged as a production fallback.
4. Set all five R2 variables in `.env.example`, including `R2_PUBLIC_BASE_URL`. Use a public media domain or R2 public URL, not the authenticated S3 API endpoint. Keep media on a separate origin from the application.
5. Add a bucket CORS rule for each exact application origin that will upload. For production at `https://wikiciv.xyz`, for example:

```json
[
  {
    "AllowedOrigins": ["https://wikiciv.xyz"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type", "Content-Disposition"],
    "MaxAgeSeconds": 3600
  }
]
```

Add a local or preview origin explicitly when testing it. The upload API checks the request Origin against `NEXT_PUBLIC_APP_URL` when set, otherwise its own URL. A preview deployment therefore needs its own app URL and matching bucket CORS entry.

6. Configure an R2 lifecycle rule that removes `staging/` objects after one day. Successful and rejected uploads are cleaned immediately; this rule cleans interrupted uploads and expired/replayed staging authorizations. Configure `X-Content-Type-Options: nosniff` on the public media domain if using a Cloudflare custom domain.

No schema change is introduced by this branch: it uses the `avatarUrl`, `status`, and `suspendedUntil` fields already present on main. The database must already match that schema. Do not apply an older branch's schema or a destructive schema reset to production.

## Upload design and limits

`POST /api/upload` accepts small JSON requests: `{ action: "start", purpose: "avatar" | "media", type, size }` authorizes a five-minute PUT to a random per-user staging key. The signature binds Content-Length, application/octet-stream, and attachment disposition. The browser supplies Content-Length automatically. The file bypasses the Vercel function request body limit.

After PUT, `{ action: "complete", purpose, key }` reads at most 10 MB from that user's staging prefix, checks the file signature and avatar restrictions, and publishes exactly those checked bytes under a different random final key. Replaying the presigned PUT cannot overwrite published media. SVG, HTML, documents, and executable formats are not accepted. Signatures do not constitute malware scanning or full codec validation. Uploaded media is public; the UI states this before selection. Replaced avatar and unattached final objects currently remain in storage; operator retention/cleanup policy must account for them.

Both phases require a same-origin, authenticated, verified contributor and have separate database-backed limits of 30 attempts per ten minutes. Metadata streams are capped at 4 KB. Limiter failures deny protected operations temporarily.

Sources: [Vercel function limits](https://vercel.com/docs/functions/limitations), [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).

## Security audit scope

Reviewed application authorization, sessions, uploads, URL handling, email link construction, account deletion, headers, and locked dependencies. Fixed:

- Stolen session cookies remaining valid after password changes or account anonymization.
- Ignored existing account suspension/ban state in authentication.
- Untrusted login redirect targets (including javascript URLs and backslash-normalized external URLs).
- Host-header-derived email verification links and production verification-token logging.
- Fail-open rate limiting, unrestricted image-proxy configuration, and overlong new bcrypt passwords (72-byte bound; existing passwords remain usable).
- Published example production signing secret, unsafe upload MIME trust, absent bounded upload validation, and vulnerable dependencies.

Validation includes unit tests and mocked integration tests for upload authorization/finalization, bounded streams, media signatures, milestones, safe redirects, and real signed JWT session invalidation. No active penetration tests were run against production, and no real production database, R2 objects, or secrets were modified.

## Integration with PR #1

The initial review of PR #1 identified unsafe Discord linking to unverified email accounts, backslash-based external OAuth redirects, and inaccurate retention guarantees. The review was posted on GitHub. When integrating its changes, preserve these security fixes; use one account-ownership/moderation model, adapt nullable OAuth passwords, scrub Discord links on deletion, and update its policy for public media storage and retention. Its new routes must also await Next.js 15 request parameters and cookies.
