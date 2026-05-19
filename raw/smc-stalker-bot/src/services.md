# Module: smc-stalker-bot/src/services

**Purpose:** Core business logic layer — alert evaluation and dispatch, guild auth management, Discord health tracking, and Dynmap polling orchestration.

**Source:** smc-stalker-bot/src/services/

## Key Files
| Path | Purpose | Key Exports |
|------|---------|-------------|
| smc-stalker-bot/src/services/alert.service.ts | Evaluate alert configs, find at-risk towns, dispatch Discord messages | createAlertService |
| smc-stalker-bot/src/services/auth.service.ts | Guild authorization (whitelist, roles, superadmins) | setAuth, getAuth |
| smc-stalker-bot/src/services/guild.service.ts | Guild CRUD operations | createGuildService |
| smc-stalker-bot/src/services/health.service.ts | Bot uptime tracking and health checks | recordBotStart, getUptimeMs, createHealthService |
| smc-stalker-bot/src/services/poll.service.ts | Dynmap data fetching, parsing, snapshot comparison, alert triggering | createPollService, PollServiceConfig |

## Data Flow
`poll.service.ts` is the orchestrator — it fetches Dynmap markers.json, parses HTML detail fields into `ParsedTownData`, upserts towns/nations/shapes into DB, takes resident snapshots, and calls `alert.service.ts` to evaluate alert configs. `alert.service.ts` checks each alert's threshold against current town data, computes at-risk towns (upkeep) or enemy changes, and dispatches Discord messages. `auth.service.ts` checks guild whitelist, user roles, and superadmin status on command invocation. `health.service.ts` records bot starts and computes uptime.

## Key Types & Interfaces
- **PollServiceConfig**: Configures poll behavior (channels, dynmap URL, etc).
- **PollStatus**: Return type with poll duration, towns found/updated, alerts fired.
- **AuthResult**: Authorization outcome with AuthContext flags.
- **BotHealth**: Health check result including uptime and last poll timestamp.

## Error Handling Patterns
Each service wraps third-party calls (Dynmap HTTP fetch, Discord API) in try/catch. Poll failures are logged and stored in PollRunRow with error_message but don't cascade. Alert evaluation failures for one config skip to the next. Auth failures return an AuthResult with `isAuthorizedUser: false` rather than throwing.

## Edge Cases & Gotchas
- Dynmap polling is the single external dependency — if the Dynmap server is down, all poll-dependent features silently return stale data until next poll.
- Alert cooldown (`cooldown_min`) prevents spam but means rapid town bank changes may be missed between cooldown windows.
- The `nation_pings` map in alert config can have null values — alert dispatch must skip nulls rather than pinging @everyone.
- Poll duration is measured client-side — doesn't account for Dynmap server processing time or network latency.
