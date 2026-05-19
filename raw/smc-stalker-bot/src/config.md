# Module: smc-stalker-bot/src/config

**Purpose:** Bot configuration — environment variable validation with Zod and project-wide constants.

**Source:** smc-stalker-bot/src/config/

## Key Files
| Path | Purpose | Key Exports |
|------|---------|-------------|
| smc-stalker-bot/src/config/env.ts | Load and validate environment variables with Zod | loadEnv, Env |
| smc-stalker-bot/src/config/constants.ts | Bot-wide constants | SUPERADMIN_ID, BOT_NAME, BOT_VERSION, POLL_INTERVAL_MS, STALE_POLL_THRESHOLD |

## Data Flow
`constants.ts` provides compile-time constants imported across the bot. `env.ts` loads `.env.local` (from the monorepo root) and validates all required environment variables via Zod schema at startup. The validated `Env` object is used throughout the app for database, Discord, and Dynmap configuration. If validation fails, the process exits with code 1 and prints specific error messages.

## Key Types & Interfaces
- **Env**: Inferred Zod type from env schema — DISCORD_TOKEN, DISCORD_CLIENT_ID, DATABASE_URL, DYNMAP_URL, DYNMAP_TIMEOUT_MS, NODE_ENV, LOG_LEVEL.
- **SUPERADMIN_ID**: Hardcoded constant for the single Discord user ID with superadmin privileges.

## Error Handling Patterns
`loadEnv()` uses Zod `safeParse` — validation failures print detailed field-by-field errors to stderr and call `process.exit(1)`. No graceful recovery: if env vars are missing, the bot cannot function. Runtime access to `process.env` is never done directly — always through the validated `Env` object.

## Edge Cases & Gotchas
- `DYNMAP_TIMEOUT_MS` uses `z.coerce.number()` — if set to a non-numeric string, defaults to 30000 without warning.
- `.env.local` is loaded from `../.env.local` (one level up, monorepo root) — running the bot from a different working directory will miss the env file.
- `SUPERADMIN_ID` is the only hardcoded value — deliberately NOT in env for security auditability (a compromised env file can't change who has ultimate admin access).
- The `POLL_INTERVAL_MS` constant (5 minutes) is a hardcoded default — if per-guild intervals are needed later, this must be moved to the DB.
