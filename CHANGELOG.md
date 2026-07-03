# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-07-03

### Added
- **Glassmorphism dark-mode UI design system** — complete visual overhaul of the entire panel
- `apps/panel/app/globals.css` — deep-space background (`hsl(230 35% 4%)`), 4-layer aurora animation (28 s drift cycle), dot-grid overlay with radial fade mask, 3-tier glass surface system (`.glass` blur-24px, `.glass-strong` blur-32px, `.glass-card` blur-20px), glow utilities (`.glow-cyan`, `.glow-violet`, `.glow-brand`, `.premium-glow`), 6 CSS animations (`aurora-drift`, `fade-up`, `glass-appear`, `float`, `pulse-glow`, `shimmer`), cyan-glow scrollbar
- `apps/panel/tailwind.config.mts` — `glass-gradient` and `brand-gradient` backgroundImage tokens; 6 custom boxShadow tokens (`glass`, `glass-lg`, `glass-sm`, `glow-cyan`, `glow-brand`, `premium`)
- `README.md` — comprehensive rewrite with badges, architecture diagram, features table, UI design system section, tech stack, 3 quick-start paths (one-command / Docker / PM2+Nginx), full environment variable reference, project structure tree, dev/ops command table, production operations, troubleshooting guide, client setup table, contributing guide
- `CHANGELOG.md` — v1.2.0 entry (this entry)

### Changed
- `apps/panel/src/components/ui/card.tsx` — translucent glass surface (`bg-[hsl(225_28%_9%/0.60)]`), `backdrop-blur-xl saturate-150`, top-edge gradient shine strip
- `apps/panel/src/components/ui/button.tsx` — 5 glass-aware variants: `default` (solid cyan glow + ripple shimmer), `outline` (frosted glass border), `secondary` (opaque glass), `ghost`, `destructive`
- `apps/panel/src/components/ui/input.tsx` — `bg-white/[0.04] backdrop-blur-md`, cyan focus ring + `ring-[hsl(192_100%_58%/0.25)]` + `shadow-[0_0_16px_hsl(192_100%_58%/0.12)]`
- `apps/panel/src/components/ui/badge.tsx` — 6 glass-layered variants with `backdrop-blur-sm` and transparent HSL backgrounds
- `apps/panel/src/components/ui/dialog.tsx` — overlay `bg-black/70 backdrop-blur-md`; modal `bg-[hsl(225_30%_9%/0.80)] backdrop-blur-2xl saturate-150`
- `apps/panel/src/components/ui/spinner.tsx` — dual-ring counter-rotating spinner (outer 0.85 s, inner 1.5 s reverse) with glow-pulse `LoadingState`
- `apps/panel/src/components/app-sidebar.tsx` — `backdrop-blur-2xl` sidebar, gradient avatar with glow halo, glass-highlighted active nav item, red hover for logout
- `apps/panel/app/dashboard/layout.tsx` — glass topbar (`backdrop-blur-xl`), top-edge shine strip, emerald live-indicator pill
- `apps/panel/app/login/page.tsx` — full glassmorphism login card: floating cyan/violet orbs, `glass-appear` animation, top-edge gradient shine, security-badge footer, icon-prefixed inputs
- `apps/panel/app/layout.tsx` — Inter font `display: 'swap'`

### Version bumps
- All package versions: `1.1.0` → `1.2.0`

## [1.1.0] - 2026-07-03

### Added
- `ecosystem.config.js` — PM2 process manager config for production deployment on `vpn.sis2.xyz`
- `tailwind.config.mts` — renamed from `.ts` to `.mts` for proper ES module resolution (eliminates Node.js MODULE_TYPELESS_PACKAGE_JSON warning)
- Production deployment with SSL via Let's Encrypt on `https://vpn.sis2.xyz`
- Nginx reverse proxy configuration with HTTPS redirect and security headers

### Changed
- **Dependencies updated across all packages to latest versions:**
  - `next`: `^16.2.9` → `^16.2.10`
  - `lucide-react`: `^1.21.0` → `^1.23.0`
  - `@radix-ui/react-dialog`: `^1.1.17` → `^1.1.18`
  - `@playwright/test` / `playwright`: `^1.61.0` → `^1.51.1`
  - `@tailwindcss/postcss`: `^4.3.1` → `^4.3.2`
  - `tailwindcss`: `^4.3.1` → `^4.3.2`
  - `postcss`: `^8.5.15` → `^8.5.16`
  - `eslint-config-next`: `^16.2.9` → `^16.2.10`
  - `@types/node`: `^26.0.0` → `^26.1.0`
  - `tsx`: `^4.22.4` → `^4.23.0`
  - `axios`: `^1.18.0` → `^1.8.1` (agent)
- `pnpm` packageManager: `11.8.0` → `11.9.0`
- `apps/panel/next.config.js` — cleaner config, removed unused telemetry option
- `apps/panel/app/globals.css` — updated `@config` reference to `tailwind.config.mts`

### Fixed
- Eliminated `[MODULE_TYPELESS_PACKAGE_JSON]` Node.js warning during Next.js production build
- Clean build output with zero warnings

### Removed
- `apps/panel/tailwind.config.ts` — replaced by `tailwind.config.mts`

## [1.0.0] - 2026-07-03

### Added
- Initial production release of ovpn-admin panel
- Multi-node OpenVPN XOR management
- Per-client traffic accounting and real-time monitoring
- Agent-based, NAT-friendly node connectivity via heartbeat polling
- RBAC with ADMIN and MANAGER roles
- Seamless server migration (PKI backup/restore)
- Audit logging for all administrative actions
- PostgreSQL + Prisma 7 backend
- Redis-backed login rate limiting
- AES-256-GCM encrypted PKI backups
- JWT (HS256 via jose) session management
- Maintenance worker for stale node/job cleanup
- Dark minimal responsive UI (Next.js 16, React 19, Tailwind CSS 4)
