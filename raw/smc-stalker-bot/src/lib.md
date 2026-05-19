# Module: smc-stalker-bot/src/lib

**Purpose:** Utility library — Dynmap HTTP client with retry, HTML detail parser, Discord embed builder, structured logging (pino), rate limiter, pagination, date/time formatters, and currency formatting.

**Source:** smc-stalker-bot/src/lib/

## Key Files
| Path | Purpose | Key Exports |
|------|---------|-------------|
| dynmap-client.ts | HTTP client for Dynmap markers.json API with retry and Zod validation | createDynmapClient, DynmapClientConfig |
| dynmap-parser.ts | Parse Dynmap marker HTML detail into structured town data | parseTownDataFromDetail |
| embed-builder.ts | Discord embed helpers for consistent message formatting | infoEmbed, warningEmbed, dangerEmbed, successEmbed |
| logger.ts | Pino structured logger with root/child pattern | createRootLogger, getLogger, createLogger |
| rate-limiter.ts | In-memory rate limiter for API call throttling | checkRateLimit, resetRateLimiters, RateLimitConfig |
| retry.ts | Exponential backoff retry wrapper | withRetry, RetryOptions |
| pagination.ts | Discord message pagination for multi-page output | PageData |
| dates.ts | Date formatting utilities | formatDateGMT, formatDateLongGMT, discordTimestamp, formatTimeGMT |
| format.ts | Text formatting utilities | escapeMD, displayDays, formatCurrency, sectioned |

## Data Flow
`dynmap-client.ts` fetches markers.json from a Dynmap server URL, validates the JSON structure with Zod schemas, passes each marker's HTML `detail` field to `dynmap-parser.ts`, and aggregates results into `DynmapPollResult`. `retry.ts` wraps the fetch with exponential backoff (3 attempts, 2s base delay, 15s max). `rate-limiter.ts` provides in-memory per-key rate limiting. `logger.ts` creates a root pino logger configured per environment (pretty-printed in dev, JSON in prod). `embed-builder.ts` creates consistent Discord embed objects for info, warning, danger, and success states.

## Key Types & Interfaces
- **DynmapClientConfig**: URL + timeout configuration for the Dynmap client.
- **RetryOptions**: maxAttempts, baseDelayMs, maxDelayMs for backoff configuration.
- **RateLimitConfig**: window duration and max hits per key.
- **PageData**: Generic pagination data structure for Discord embed pages.
- **DynmapPollResult**: Complete poll result with towns, shapes, timing, and error status.

## Error Handling Patterns
`dynmap-client.ts` wraps the entire fetch-and-parse flow in try/catch, returning a `DynmapPollResult` with `success: false` and an error message on failure — never throws. `dynmap-parser.ts` uses Zod `safeParse` to validate parsed town data, logging warnings on validation failures and returning null for individual towns rather than failing the entire batch. `retry.ts` throws only after all retries are exhausted.

## Edge Cases & Gotchas
- `dynmap-client.ts` uses `zod` to validate the markers.json structure but falls back to raw cast if validation fails — this means malformed API responses may produce runtime type errors downstream.
- `dynmap-parser.ts` regex for field extraction assumes the detail HTML follows a specific `<br>`-delimited format. If the Dynmap plugin changes its detail HTML format, all parsing breaks silently (returns defaults).
- The bank value can be negative (towns in debt) — the parser preserves this via `Number.parseFloat` without clamping.
- The `logger.ts` root logger is initialized lazily with defaults if `createLogger` is called before `createRootLogger` in the boot sequence — log level defaults to 'info' and output is JSON-only (no pretty printing).
- `rate-limiter.ts` is in-memory with no persistence — rate limit state resets on bot restart.
