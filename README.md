# SMC Stalker Bot

Multi-guild Discord upkeep tracking bot for the **SovereignMC** Minecraft Towny server. Polls dynmap every 5 minutes, tracks 125+ towns across 17+ nations, and sends scheduled alerts when upkeep is at risk.

---

## Commands

### 🔍 Upkeep Lookups

| Command | Description |
|---|---|
| `/upkeep-town <name>` | Full town details — residents (with names), nation, status (peaceful/unpeaceful), founded date, bank, upkeep, days until insolvent, mayor's player head. Colored by nation. |
| `/upkeep-nation <name> [days]` | Nation overview — total towns, residents, bank, upkeep. Lists all towns in the nation. Optionally show at-risk towns within N days. |
| `/list towns` | Paginated list of all towns with nation, upkeep, bank, and residents. |
| `/list nations` | Paginated list of all nations with last-seen timestamps. |
| `/at-risk <days>` | Paginated list of ALL towns going bankrupt within N days, sorted by urgency (most urgent first). Shows nation, bank, upkeep, and days left. |
| `/player <name>` | Look up any player — finds their town and nation by searching mayor and resident names, shows their Minecraft head. |

### 🔔 Alerts

Alerts are evaluated every 5 minutes after a dynmap poll. They are dispatched to a channel you configure.

**Upkeep Alerts**
```
/alert-configure upkeep create channel:#alerts [time:20:00] [threshold-days:7]
```
At the scheduled time (GMT), the bot posts a list of towns whose bank is below the threshold. Towns are grouped by nation, each with its own role ping.

**Friendly Nation Alerts**
```
/alert-configure friendly add nation:Iberia [role:@role]
```
Monitors allied nations for low funds. Adding a nation with a role sets a per-nation ping for that nation's at-risk towns.

**Enemy Nation Alerts**
```
/alert-configure enemy add nation:Cultist_Empire
```
Detects changes in adversarial nations — bank drops, mayor changes, resident shifts, new towns.

**View All Alerts**
```
/alerts
```
Unified overview showing every alert config with type, channel, schedule, threshold (N), and per-nation role pings.

```
/alert-status
```
Quick summary of alert configs.

### 🔑 Access & Permissions

| Command | Who | Description |
|---|---|---|
| `/access` | Anyone | Request access to use bot commands in this server. Sends DM to superadmin with approve/deny buttons. |
| `/admin-pending` | Superadmin | Review and approve/deny pending access requests. |
| `/admin-whitelist add <id>` | Superadmin | Whitelist a guild by ID. Commands deploy immediately. |
| `/admin-whitelist remove <id>` | Superadmin | Remove guild from whitelist. |
| `/admin-whitelist list` | Superadmin | List all whitelisted guilds. |
| `/admin-admin add <id> <user>` | Superadmin | Promote to guild admin (can configure alerts). |
| `/admin-admin remove <id> <user>` | Superadmin | Demote guild admin. |
| `/admin-admin list <id>` | Superadmin | List guild admins. |
| `/admin-inspect <id>` | Superadmin | View full guild configuration. |
| `/admin-toggle-auth <id> <mode>` | Superadmin | `on` = auth enforced, `off` = open access for everyone. |

**Auth Levels** (first match wins):

| Level | Can do |
|---|---|
| Superadmin | Everything (bypasses all checks) |
| Auth toggle OFF | Everything (everyone in guild) |
| Guild admin | All commands including alert config |
| Approved user | Upkeep lookups, `/alerts`, `/list`, `/at-risk`, `/player` |
| Authorized role member | Same as approved user |
| Everyone else | `/access`, `/help` |

### ℹ️ Help

| Command | Description |
|---|---|
| `/help` | Full categorized command reference. |

---

## Features

### Dynmap Polling
- Polls `markers.json` every **5 minutes** — single source of truth
- Parses town name, mayor, residents (count + names), nation, status (peaceful/unpeaceful), founded date, bank, upkeep
- Extracts **fill colors** from territory shapes for per-nation embed coloring
- Exponential backoff retry (3 attempts), timeout handling, stale data detection
- Structured logging for every poll cycle

### Territory Tracking
- Full polygon geometry stored per town (Minecraft XZ coordinates)
- Towns with multiple non-contiguous claim areas supported (`_region_0`, `_region_1`, etc.)
- Historical territory snapshots preserved

### Resident Analytics
- **Daily resident time series** — one row per town per day
- Nation-level resident totals aggregated automatically
- Ready for trend charts and analytics (7d/30d/1y changes)

### Visual Design
- **Sectioned embed layout** — grouped into Location, Residents, Finances, Government
- **Player heads** — mayor's Minecraft skin via mc-heads.net thumbnail
- **Embed colors** — extracted from dynmap territory fill colors, averaged per nation
- **GMT timestamps** — all dates shown in GMT (founded, last seen, schedule times)
- **Markdown escaping** — names with underscores (`_8viser8_`) no longer get italicized

### Multi-Guild Architecture
- Fully isolated configs per guild — users, roles, alert configs, tracked nations
- No global authorization (except superadmin)
- Per-guild slash command registration for instant updates

### Alert System
- **Upkeep alerts** — configurable threshold (N days), schedule (HH:MM GMT), channel, per-nation role pings
- **Friendly nation alerts** — monitor allied nations with per-nation role pings
- **Enemy activity alerts** — detect bank drops, mayor changes, resident shifts, new towns
- **Cooldown protection** — minimum interval between alerts per config
- **Confirmation messages** — ✅ sent after each alert dispatch

### Auth System
- **Request-based access** — users run `/access`, superadmin approves via DM buttons or `/admin-pending`
- **Role-based authorization** — authorized Discord roles get access without individual approval
- **Auth toggle** — disable all checks per guild for open access
- **Superadmin bypass** — hardcoded superadmin ID skips all checks

### Tech Stack
- **Runtime:** Node.js, TypeScript (strict mode)
- **Discord:** discord.js v14, slash commands only
- **Database:** Supabase Postgres via postgres.js, 5 versioned migrations
- **Validation:** Zod at every system boundary (env vars, dynmap data, command input)
- **Logging:** Pino structured JSON logger, pretty-print in dev
- **Container:** Docker multi-stage build, docker-compose

### Architecture
```
src/
├── index.ts              Entry point
├── bot.ts                Discord client lifecycle
├── config/               Zod env validation, constants
├── types/                TypeScript types (DB, dynmap, alerts, Discord)
├── db/                   postgres.js client + SQL migrations
├── repositories/         12 typed repository modules
├── services/             5 business logic modules
├── workers/              Poller loop + alert dispatch
├── commands/             14 slash command handlers
├── events/               Discord event handlers
└── lib/                  Utilities (logger, retry, parser, embeds, pagination)
```

---

## Setup (for server admins)

### Step 1 — Get whitelisted

The bot only operates in whitelisted servers. Contact the bot superadmin with your server's Discord ID. They run:
```
/admin-whitelist add <guild-id>
```
Commands deploy immediately — no restart needed.

### Step 2 — Get access

Once whitelisted, run `/access` in your server. The superadmin receives a DM with Approve/Deny buttons. Once approved, you can use all upkeep lookup commands.

### Step 3 — Add a guild admin (optional)

If you want someone to configure alerts, the superadmin promotes them:
```
/admin-admin add <guild-id> <@user>
```

### Step 4 — Configure alerts

1. **Create an upkeep alert** — `/alert-configure upkeep create channel:#alerts time:20:00 threshold-days:7`
2. **Add friendly nations** — `/alert-configure friendly add nation:Iberia role:@iberia-team`
3. **Add enemy nations** — `/alert-configure enemy add nation:Cultist_Empire`
4. **Verify** — `/alerts` shows all configs with their thresholds, schedules, and pings
