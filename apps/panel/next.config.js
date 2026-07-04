/** @type {import('next').NextConfig} */

// Read version from the nearest package.json at build time so
// NEXT_PUBLIC_APP_VERSION is baked into the client bundle automatically.
const { version } = require('./package.json');

// ============================================================================
// Security headers — applied to every response via Next.js headers() API.
//
// Designed for a production-only admin panel served via Nginx + Cloudflare.
// Headers are split into three groups and applied with different path matchers:
//
//   1. GLOBAL_HEADERS       — every response (HTML, JSON, static assets, etc.)
//   2. HTML_HEADERS         — HTML pages only (not API routes / static files)
//   3. STATIC_ASSET_HEADERS — /_next/static/** (long-lived immutable assets)
//
// This avoids:
//   - Adding a full CSP to JSON API responses (unnecessary overhead)
//   - Sending Cache-Control: no-store on versioned JS/CSS (breaks caching)
//   - Cloudflare caching sensitive dashboard HTML pages
// ============================================================================

// ----------------------------------------------------------------------------
// 1. GLOBAL_HEADERS — applied to every route
// ----------------------------------------------------------------------------
const GLOBAL_HEADERS = [
  // Prevent MIME-sniffing attacks
  { key: 'X-Content-Type-Options',      value: 'nosniff' },

  // Refuse to be embedded in any frame (belt + CSP frame-ancestors)
  { key: 'X-Frame-Options',             value: 'DENY' },

  // Disable legacy XSS auditor (CSP supersedes it; the auditor itself has bugs)
  { key: 'X-XSS-Protection',            value: '0' },

  // Suppress Referer on cross-origin navigations; pass origin only on same-origin
  { key: 'Referrer-Policy',             value: 'strict-origin-when-cross-origin' },

  // Disable DNS prefetching (reduces information leakage on outbound links)
  { key: 'X-DNS-Prefetch-Control',      value: 'off' },

  // HSTS — 2 years, include subdomains, preload-eligible.
  // Requires vpn.sis2.xyz to be HTTPS-only permanently before submitting to
  // the HSTS preload list (https://hstspreload.org).
  {
    key:   'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },

  // Permissions-Policy — deny access to sensors, hardware APIs, and tracking.
  // Only standardised, shipping directives are included here. Unrecognised
  // feature names (e.g. "web-share" was removed from the spec in 2024) emit a
  // browser warning and should be omitted to keep the header clean.
  // interest-cohort=() is the legacy FLoC opt-out; browsing-topics=() is the
  // Privacy Sandbox Topics API successor — both are kept for broad compatibility.
  {
    key:   'Permissions-Policy',
    value: [
      'accelerometer=()',
      'camera=()',
      'cross-origin-isolated=()',
      'display-capture=()',
      'encrypted-media=()',
      'fullscreen=(self)',
      'geolocation=()',
      'gyroscope=()',
      'keyboard-map=()',
      'magnetometer=()',
      'microphone=()',
      'midi=()',
      'payment=()',
      'picture-in-picture=()',
      'publickey-credentials-get=()',
      'screen-wake-lock=()',
      'sync-xhr=()',
      'usb=()',
      // 'web-share=()' — REMOVED: no longer a recognised Permissions-Policy
      //   feature; Chrome ≥ 124 logs a console warning for it.
      'xr-spatial-tracking=()',
      'interest-cohort=()',   // legacy FLoC opt-out
      'browsing-topics=()',   // Topics API opt-out
    ].join(', '),
  },

  // Cross-Origin-Opener-Policy — isolates the browsing context from cross-origin
  // openers (protects against Spectre-style cross-origin attacks and popup abuse).
  { key: 'Cross-Origin-Opener-Policy',    value: 'same-origin' },

  // Cross-Origin-Resource-Policy — prevents other origins from reading our
  // responses via <img>, <script>, fetch(), etc.
  { key: 'Cross-Origin-Resource-Policy',  value: 'same-origin' },
];

// ----------------------------------------------------------------------------
// 2. HTML_HEADERS — only on navigable HTML pages (not API / static assets)
// Includes CSP + cache directives that must NOT apply to JSON APIs or
// long-lived versioned static files.
// ----------------------------------------------------------------------------
const HTML_HEADERS = [
  // Cache-Control: no-store on all HTML responses.
  // Prevents Cloudflare, CDNs, and browser caches from storing sensitive
  // dashboard pages (login state, node data, client configs).
  { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate' },

  // Content-Security-Policy
  //
  // script-src 'self' 'unsafe-inline':
  //   Next.js 16 App Router / RSC streaming injects inline <script> tags to
  //   push RSC payload (self.__next_f.push([...])) on every page load. These
  //   scripts contain per-request dynamic data (route params, timestamps, etc.)
  //   so their SHA256 hashes change every response — hash-based allowlisting is
  //   not feasible without a per-request nonce middleware.
  //
  //   'unsafe-inline' is the pragmatic trade-off accepted by virtually all
  //   Next.js App Router deployments. XSS protection is still provided by:
  //     • Strict output encoding in React (dangerouslySetInnerHTML not used)
  //     • object-src 'none' — blocks Flash / legacy plugin exploits
  //     • base-uri 'self' — prevents base-tag hijacking
  //     • form-action 'self' — prevents form phishing redirect
  //     • frame-ancestors 'none' — prevents clickjacking
  //     • connect-src 'self' — restricts fetch/XHR to same origin
  //
  //   Cloudflare Beacon (analytics) script is allowlisted via script-src-elem
  //   so Cloudflare can inject it without needing 'unsafe-inline' on the main
  //   script-src directive.
  //
  // style-src 'unsafe-inline':
  //   Required — Tailwind CSS v4 injects inline style attributes at runtime.
  //
  // connect-src 'self' wss://vpn.sis2.xyz:
  //   'self' covers API calls. wss:// covers RSC WebSocket on same host.
  //
  // script-src-elem:
  //   Allows the Cloudflare Web Analytics beacon loaded from
  //   static.cloudflareinsights.com. script-src-elem overrides script-src for
  //   <script src="..."> elements, so 'unsafe-inline' stays scoped to inline
  //   only (script-src applies to both unless script-src-elem is set).
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // 'unsafe-inline' required for Next.js RSC streaming inline scripts
      "script-src 'self' 'unsafe-inline'",
      // Allow Cloudflare Beacon <script src="..."> via explicit elem override
      "script-src-elem 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' wss://vpn.sis2.xyz",
      "media-src 'none'",
      "object-src 'none'",
      "frame-src 'none'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "worker-src 'none'",
      "manifest-src 'self'",
      "upgrade-insecure-requests",
      "block-all-mixed-content",
    ].join('; '),
  },
];

// ----------------------------------------------------------------------------
// 3. STATIC_ASSET_HEADERS — /_next/static/** (versioned, immutable)
// Long-lived cache is correct here — filenames are content-hashed.
// Cross-Origin-Resource-Policy must be 'cross-origin' so Cloudflare CDN
// edge nodes (a different origin) can serve these files.
// ----------------------------------------------------------------------------
const STATIC_ASSET_HEADERS = [
  { key: 'Cache-Control',               value: 'public, max-age=31536000, immutable' },
  { key: 'Cross-Origin-Resource-Policy', value: 'cross-origin' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@ovpn/db', '@ovpn/api', '@ovpn/types'],
  serverExternalPackages: ['@prisma/client', 'prisma'],

  // Expose version to client components via process.env.NEXT_PUBLIC_APP_VERSION
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
    NEXT_PUBLIC_BUILD_TIME:  new Date().toISOString(),
  },

  async headers() {
    return [
      // Global: every response
      {
        source:  '/(.*)',
        headers: GLOBAL_HEADERS,
      },
      // HTML pages: navigable routes (not API, not static assets)
      {
        source: '/((?!api/|_next/static|_next/image|favicon.ico).*)',
        headers: HTML_HEADERS,
      },
      // Static assets: versioned, immutable, long-cached
      {
        source:  '/_next/static/(.*)',
        headers: STATIC_ASSET_HEADERS,
      },
    ];
  },

  // Do not expose Next.js version in X-Powered-By header
  poweredByHeader: false,
};

module.exports = nextConfig;
