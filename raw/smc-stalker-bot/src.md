# Module: smc-stalker-bot/src

**Purpose:** Discord bot entry point and client initialization — sets up the Discord.js client, registers event handlers, logs in, and handles graceful shutdown.

**Source:** smc-stalker-bot/src/

## Key Files
| Path | Purpose | Key Exports |
|------|---------|-------------|
| smc-stalker-bot/src/bot.ts | Discord.js client factory with intents, event binding, login | `BotConfig`, (via `createBot`) |
| smc-stalker-bot/src/index.ts | Entry point: loads env, runs health check, starts bot | (side-effect script) |

## Data Flow
`src/index.ts` is the process entry point. It loads environment config (`loadEnv`), optionally records a health-check bot start via `recordBotStart` (health service), then starts the Discord client. `src/bot.ts` creates the Discord.js Client with Guilds/GuildMessages/MessageContent intents, attaches interaction and ready event handlers (from `src/events/`), and logs in using the bot token. On SIGINT/SIGTERM, it destroys the client and exits cleanly.

## Key Types & Interfaces
- **BotConfig**: Configuration shape for the bot (extends/uses env-loaded values).
- **Client** (from discord.js): Discord.js client with configured intents.

## Error Handling Patterns
Process-level error handling via `process.on('SIGINT', ...)` and `process.on('SIGTERM', ...)` for graceful shutdown. Unhandled promise rejections in the Discord client are caught internally by discord.js. Login failures throw and crash the process (intentional — no point running without auth).

## Edge Cases & Gotchas
- The bot requires all three intents (Guilds, GuildMessages, MessageContent) — missing any silently disables message-based commands.
- `recordBotStart` is called before `client.login()` — if the health service DB call fails, the bot still starts (non-fatal).
- Process shutdown must call `client.destroy()` to close the WebSocket connection; otherwise, Discord sees a zombie connection for ~90s.
