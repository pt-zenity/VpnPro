# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.3.0] - 2026-07-04

### Added

- **Real-time traffic monitor** — new `/dashboard/traffic` page with:
  - Fleet-wide summary cards: Online Now, Upload Speed (bytes/s), Download Speed (bytes/s), Healthy Nodes
  - Live sessions table (desktop) / cards (mobile): client name, node, real IP, VPN IP,
    session duration, cumulative bytes, per-session speed (↑/↓ bytes/s between 5 s polls)
  - Per-node cards with SVG sparkline charts (connected clients & CPU % history),
    cumulative traffic totals, and heartbeat age
  - Auto-refresh every 5 s with manual Refresh button and Live badge
  - Fully scoped: Managers only see their assigned nodes and clients
- **`GET /api/traffic`** — new REST endpoint returning live sessions, per-node aggregates
  (with 20-point sparkline history from `HealthCheck`), fleet totals, and a `timestamp`
  for client-side delta/speed calculation. All `BigInt` byte values serialized as strings
- **`GET /api/version`** — public (no auth) endpoint returning
  `{ version, label, name, builtAt }` for health probes and deployment verification
- **`src/lib/version.ts`** — single source of truth for `APP_VERSION` / `APP_VERSION_LABEL`;
  value baked at build time from `package.json` via `next.config.js` env injection
- **Version badge in topbar** — frosted-glass pill `v1.3.0` on the right side of the
  header bar; hidden on mobile, tooltip on hover
- **Version string in sidebar** — `OVPN Admin v1.3.0` in monospace at the bottom of the
  sidebar, subtle `muted/40` colour
- **Live Traffic widget on Dashboard home** — compact card showing online clients,
  total upload/download, healthy node count; refreshes every 10 s silently;
  "View details →" link to `/dashboard/traffic`
- **`scripts/deploy.sh`** — VPS-side deploy script: `git pull` → `pnpm install` →
  `prisma migrate deploy` → `panel build` → `worker build` → copy static assets →
  `pm2 reload` (zero-downtime) → local health check
- **`scripts/setup-github-actions.sh`** — one-shot helper for setting up GitHub Secrets
  and pushing workflow files when a PAT with `workflow` scope is available
- **Traffic nav entry** in sidebar (Activity icon) between Clients and Jobs
- **`nginx.ovpn-admin.conf`** — Nginx reverse proxy config checked in as reference

### Changed

- `apps/panel/next.config.js` — injects `NEXT_PUBLIC_APP_VERSION` (from `package.json`)
  and `NEXT_PUBLIC_BUILD_TIME` (ISO timestamp) into the client bundle at build time
- `apps/panel/app/dashboard/layout.tsx` — topbar right side now shows version badge
  alongside decorative glow dots
- `apps/panel/src/components/app-sidebar.tsx` — version string added below Sign out;
  Traffic nav item added; `APP_VERSION_LABEL` imported from `version.ts`

### Fixed (v1.2.x patches — included in v1.3.0)

- **CRITICAL — `PATCH /api/nodes/:id` leaked `apiToken` and `pkiBackup`** — added
  explicit `select` clause to `prisma.node.update()` so only safe fields are returned
- **`POST /api/nodes` handler signature mismatch** — `withFullAdmin` HOF expects
  `(request, payload, context)`; `payload: AuthPayload` parameter was missing
- **Zod `hostSchema` error message typo** — missing closing `)` in
  `'Invalid host (IP or domain expected)'`
- **Dead `experimental.serverActions` config block** — removed from `next.config.js`
  (not a valid Next.js 16 option)
- **6× CSP violations on `/login`** — Next.js 16 RSC streaming injects inline
  `self.__next_f.push()` scripts with per-request dynamic data; SHA256 hashes change
  every response so hash allowlisting is infeasible; added `'unsafe-inline'` to
  `script-src` and `script-src-elem` as the accepted production trade-off
- **Cloudflare Analytics beacon blocked** — added `https://static.cloudflareinsights.com`
  to `script-src-elem` directive
- **`Permissions-Policy: web-share=()`** — removed; Chrome ≥ 124 logs an
  "unrecognised feature" warning because `web-share` was removed from the spec in 2024
- **`/favicon.ico` 404** — created `apps/panel/public/favicon.ico` (16 × 16 + 32 × 32 +
  48 × 48 ICO, OVPN brand colours: dark navy `#0b1220`, cyan ring `#22d3ee`)
- **Login form autocomplete warning** — added `autoComplete="username"` and
  `autoComplete="current-password"` to the respective inputs in `login/page.tsx`
- **`icons` metadata missing** — added `icons: { icon, shortcut }` to `app/layout.tsx`
  metadata to prevent redundant favicon 404 requests

### Security (v1.2.x patches)

- Added `Cross-Origin-Opener-Policy: same-origin` and
  `Cross-Origin-Resource-Policy: same-origin` headers (protect against Spectre and
  cross-origin resource reads)
- Split HTTP headers into three route matchers (global / HTML pages / static assets)
  to avoid sending CSP on JSON API responses and to enable long-lived caching on
  content-hashed static files while keeping `no-store` on HTML

### Version bumps

- All 7 packages: `1.2.0` → `1.3.0`

---

## [1.2.0] - 2026-07-03

### Added

- **Glassmorphism dark-mode UI design system** — complete visual overhaul
- `apps/panel/app/globals.css` — deep-space background (`hsl(230 35% 4%)`),
  4-layer aurora animation (28 s drift cycle), dot-grid overlay with radial fade
  mask, 3-tier glass surface system (`.glass` blur-24px, `.glass-strong`
  blur-32px, `.glass-card` blur-20px), glow utilities (`.glow-cyan`,
  `.glow-violet`, `.glow-brand`, `.premium-glow`), 6 CSS animations
  (`aurora-drift`, `fade-up`, `glass-appear`, `float`, `pulse-glow`, `shimmer`),
  cyan-glow scrollbar
- `apps/panel/tailwind.config.mts` — `glass-gradient` and `brand-gradient`
  backgroundImage tokens; 6 custom boxShadow tokens (`glass`, `glass-lg`,
  `glass-sm`, `glow-cyan`, `glow-brand`, `premium`)

### Changed

- `apps/panel/src/components/ui/card.tsx` — translucent glass surface, `backdrop-blur-xl saturate-150`, top-edge gradient shine strip
- `apps/panel/src/components/ui/button.tsx` — 5 glass-aware variants: `default` (solid cyan glow + ripple shimmer), `outline` (frosted glass border), `secondary` (opaque glass), `ghost`, `destructive`
- `apps/panel/src/components/ui/input.tsx` — `bg-white/[0.04] backdrop-blur-md`, cyan focus ring
- `apps/panel/src/components/ui/badge.tsx` — 6 glass-layered variants with `backdrop-blur-sm`
- `apps/panel/src/components/ui/dialog.tsx` — overlay `bg-black/70 backdrop-blur-md`; modal `backdrop-blur-2xl saturate-150`
- `apps/panel/src/components/ui/spinner.tsx` — dual-ring counter-rotating spinner with glow-pulse `LoadingState`
- `apps/panel/src/components/app-sidebar.tsx` — `backdrop-blur-2xl` sidebar, gradient avatar with glow halo, glass-highlighted active nav item
- `apps/panel/app/dashboard/layout.tsx` — glass topbar, top-edge shine strip, emerald live-indicator pill
- `apps/panel/app/login/page.tsx` — full glassmorphism login card: floating cyan/violet orbs, `glass-appear` animation, security-badge footer
- `apps/panel/app/layout.tsx` — Inter font `display: 'swap'`

### Version bumps

- All packages: `1.1.0` → `1.2.0`

---

## [1.1.0] - 2026-07-03

### Added

- `ecosystem.config.js` — PM2 process manager config for production deployment on `vpn.sis2.xyz`
- `tailwind.config.mts` — renamed from `.ts` for proper ES module resolution
- Production deployment with SSL via Let's Encrypt on `https://vpn.sis2.xyz`
- Nginx reverse proxy configuration with HTTPS redirect and security headers

### Changed

- Dependencies updated to latest across all packages (`next`, `lucide-react`,
  `@radix-ui/*`, `@playwright/test`, `tailwindcss`, `postcss`, `@types/node`, `tsx`, `axios`)
- `pnpm` packageManager: `11.8.0` → `11.9.0`
- `apps/panel/next.config.js` — cleaner config, removed unused telemetry option

### Fixed

- Eliminated `[MODULE_TYPELESS_PACKAGE_JSON]` Node.js warning during Next.js production build

### Removed

- `apps/panel/tailwind.config.ts` — replaced by `tailwind.config.mts`

### Version bumps

- All packages: `1.0.0` → `1.1.0`

---

## [1.0.0] - 2026-07-03

### Added

- Initial production release of OVPN Admin Panel
- Multi-node OpenVPN XOR management from a single dashboard
- Per-client traffic accounting (cumulative upload/download, online status)
- Agent-based, NAT-friendly node connectivity via outbound HTTPS heartbeat polling
- RBAC with `SUPERADMIN`, `ADMIN`, and `MANAGER` roles
- Seamless server migration (full PKI backup/restore — AES-256-GCM encrypted)
- Audit logging for all administrative actions (actor, IP, timestamp)
- PostgreSQL 16 + Prisma 7 backend with 9 models
- Redis-backed dual rate limiting (per-IP + per-email) on login
- JWT (HS256 via jose 6) session management with HttpOnly + SameSite cookies
- Maintenance worker: marks stale nodes UNHEALTHY, times out hung jobs, expires clients
- Client lifecycle: create, disable (reversible), revoke (CRL + immediate reload), download `.ovpn`
- Health monitoring: CPU, RAM, disk, uptime, load average, connected clients — per node
- Dark minimal responsive UI (Next.js 16, React 19, Tailwind CSS 4)
- Zod validation on all API request bodies (`@ovpn/api` package)
- Shared TypeScript types (`@ovpn/types` package)
- pnpm monorepo workspace (`apps/panel`, `apps/worker`, `apps/agent`, `packages/*`)
