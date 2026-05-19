# Module: smc-stalker-website

**Purpose:** Next.js frontend website configuration — project scaffolding, lint rules, build pipeline, and CSS toolchain setup.

**Source:** smc-stalker-website/

## Key Files
| Path | Purpose | Key Exports |
|------|---------|-------------|
| smc-stalker-website/eslint.config.mjs | ESLint config with Next.js core-web-vitals + TypeScript rules | `eslintConfig` |
| smc-stalker-website/next.config.ts | Next.js app configuration | `nextConfig` |
| smc-stalker-website/postcss.config.mjs | PostCSS with Tailwind CSS v4 plugin | `config` |

## Data Flow
These are static configuration files loaded by the Next.js/ESLint/PostCSS toolchains at build time. No runtime data flows through them — they define tool behavior rather than application logic. `next.config.ts` is parsed by the Next.js server at startup; `eslint.config.mjs` by ESLint during lint; `postcss.config.mjs` by PostCSS during build.

## Key Types & Interfaces
- **NextConfig** (from `next`): Type interface for Next.js configuration options. Currently uses defaults.
- **eslint-config-next/core-web-vitals**, **eslint-config-next/typescript**: Preset ESLint configurations extending Next.js recommended rules.

## Error Handling Patterns
No runtime error handling — these are config files evaluated at build/startup. Failures manifest as build errors with clear toolchain messages. ESLint configs are validated by ESLint itself; `next.config.ts` by TypeScript at compile time.

## Edge Cases & Gotchas
- ESLint globalIgnores must match the Next.js convention — missing `.next/**` or `next-env.d.ts` causes linting of generated files.
- PostCSS config uses `@tailwindcss/postcss` v4 — different plugin name from v3 (`tailwindcss`). Using the wrong plugin name silently disables Tailwind.
- `next.config.ts` is currently empty (default settings). Any future customization should preserve the typed pattern.
