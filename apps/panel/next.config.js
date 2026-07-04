/** @type {import('next').NextConfig} */

// ---------------------------------------------------------------------------
// Security-response headers applied to every route.
// Content-Security-Policy is intentionally strict:
//   - no inline scripts (nonce-based if we ever need them)
//   - no object/embed/base-uri elevation
//   - connect-src limits XHR to same-origin only
//   - frame-ancestors: none → clickjacking protection
// Adjust connect-src if you add third-party analytics or fonts later.
// ---------------------------------------------------------------------------
const securityHeaders = [
  // Prevent browsers from MIME-sniffing the response type
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // No iframing by anyone
  { key: 'X-Frame-Options', value: 'DENY' },
  // Disable legacy XSS auditor (modern CSP replaces it)
  { key: 'X-XSS-Protection', value: '0' },
  // Control referrer leakage
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Permissions policy — lock down sensors/location/camera
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  },
  // HSTS — 2 years, include subdomains, preload-eligible
  // IMPORTANT: only activate once you are certain HTTPS is permanent.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // Content-Security-Policy
  // default-src 'self' — all fetch directives start from same-origin.
  // style-src 'self' 'unsafe-inline' — Tailwind injects inline styles; narrow
  //   this once you have a nonce/hash strategy in place.
  // img-src 'self' data: — avatars & SVG data URIs used in the UI.
  // connect-src 'self' — API calls stay same-origin; no CDN leakage.
  // worker-src 'none' — no service workers needed.
  // frame-ancestors 'none' — belt + suspenders with X-Frame-Options.
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval'",   // 'unsafe-eval' required by Next.js dev HMR; remove in prod builds if possible
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "media-src 'none'",
      "object-src 'none'",
      "frame-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "worker-src 'none'",
      "upgrade-insecure-requests",
    ].join('; '),
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@ovpn/db', '@ovpn/api', '@ovpn/types'],
  serverExternalPackages: ['@prisma/client', 'prisma'],

  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // Attach security headers to every response.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },

  // Do not expose the Next.js version in the X-Powered-By header.
  poweredByHeader: false,
};

module.exports = nextConfig;
