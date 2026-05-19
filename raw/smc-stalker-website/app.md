# Module: smc-stalker-website/app

**Purpose:** Next.js App Router pages and layout — root HTML shell and default landing page for the frontend website.

**Source:** smc-stalker-website/app/

## Key Files
| Path | Purpose | Key Exports |
|------|---------|-------------|
| smc-stalker-website/app/layout.tsx | Root HTML layout with Geist fonts, metadata, dark mode support | `RootLayout`, `metadata` |
| smc-stalker-website/app/page.tsx | Default homepage with Next.js template placeholder content | `Home` |

## Data Flow
This is the App Router entry point. `layout.tsx` wraps all pages — it provides the HTML shell (Geist fonts via CSS variables, responsive dark mode via `antialiased` + `flex flex-col` body). `page.tsx` renders at `/` as the default landing page. Currently displays static template content (Next.js logo, deploy links, documentation links). No dynamic data fetching — purely static rendering.

## Key Types & Interfaces
- **Metadata** (from `next`): Standard Next.js metadata for SEO/head. Currently set to default "Create Next App" values.
- **Readonly<React.ReactNode>**: Type-safe children prop for the layout component.

## Error Handling Patterns
No explicit error handling — these are server components rendered at build/request time. Next.js App Router error boundaries (`error.tsx`) would catch runtime issues in child pages but are not yet implemented.

## Edge Cases & Gotchas
- Geist font variables (`--font-geist-sans`, `--font-geist-mono`) must be defined here — removing them breaks all font references across the app.
- Dark mode uses a conditional `dark:invert` on the Next.js logo — images may look wrong if `prefers-color-scheme` handling changes.
- The `h-full` and `flex flex-col` on body is required for the sticky footer pattern — removing it breaks page height calculations.
