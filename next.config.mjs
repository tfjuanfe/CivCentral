/** @type {import('next').NextConfig} */

const isDev = process.env.NODE_ENV !== "production";

// Content Security Policy. Inline scripts/styles are allowed because Next.js
// (and the no-flash theme script) rely on them; markdown is already sanitized,
// so the main wins here are blocking framing, plugins, and base/form hijacking.
// 'unsafe-eval' is only added in dev for fast refresh.
const csp = [
  "default-src 'self'",
  "img-src 'self' https: data: blob:",
  "style-src 'self' 'unsafe-inline'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "font-src 'self' data:",
  "connect-src 'self' https://*.r2.cloudflarestorage.com",
  "media-src 'self' https:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig = {
  // Media uses native browser elements; do not expose an arbitrary-host image proxy.
  images: { unoptimized: true },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
