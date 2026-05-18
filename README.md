# SMC Stalker Bot

Multi-guild Discord upkeep tracking bot for the **SovereignMC** Minecraft Towny server. Polls the dynmap in real time, tracks town/nation finances and territory, and sends scheduled alerts when upkeep is at risk.

---

## How to Use

### Slash Commands

All bot commands are slash commands — type `/` in any channel the bot can see and browse the available commands.

#### Upkeep Lookups

| Command | What it does |
|---|---|
| `/upkeep-town <name>` | Shows a town's bank balance, daily upkeep cost, residents, mayor, nation, and how many days until it runs out of funds. |
| `/upkeep-nation <name>` | Shows a nation-wide breakdown — total bank, total upkeep, average per town, and how many towns are at risk (bank < 7 days of upkeep). |
| `/list towns` | Paginated list of every town with its upkeep and bank. Use the ◀ ▶ buttons to navigate. |
| `/list nations` | Paginated list of every nation. |

#### Alerts

Alerts are evaluated every 5 minutes after a dynmap poll. They are dispatched to a channel you configure.

**Upkeep Alerts** — `/alert-configure upkeep create`
Pick an alert channel, set the threshold (e.g. "alert when bank < 7 days of upkeep"), optionally pick a role to ping. At the scheduled time, the bot posts a list of all towns below the threshold.

**Friendly Nation Alerts** — `/alert-configure friendly`
Add nations you're allied with. The bot will include their towns in the same low-funds check and alert you.

**Enemy Nation Alerts** — `/alert-configure enemy`
Add adversarial nations. The bot detects changes in their towns — territory expansion, sudden bank drops, mayor changes, resident shifts — and posts an activity report.

**View Config** — `/alert-status`
Lists all active alert configurations for the current server.

#### Help

| Command | What it does |
|---|---|
| `/help` | Shows the full command reference with descriptions. |

---

## Setup (for server admins)

### Step 1 — Get whitelisted

The bot only operates in servers that have been whitelisted by the bot owner. Contact the bot superadmin and provide your server's Discord ID.

### Step 2 — Add an admin

The superadmin runs `/admin-admin add` with your user ID. This gives you permission to configure alerts.

### Step 3 — Configure alerts

Use `/alert-configure upkeep create` to set up your first alert:

1. Select the channel where alerts should appear
2. Set the threshold (default: 7 days of upkeep remaining)
3. Optionally pick a role to ping

Use `/alert-configure friendly add` to add allied nations you want to monitor.

Use `/alert-configure enemy add` to add adversarial nations for change detection.

### Step 4 — Check status

Run `/alert-status` to verify everything is configured correctly.

---

## Features

- **Global dynmap polling** every 5 minutes — single source of truth
- **Historical snapshots** — bank/upkeep/residents tracked over time
- **Full polygon storage** — territory shapes preserved for analysis
- **Multi-guild isolation** — each server has its own configs, nations, and alerts
- **Pagination** — large lists use embedded navigation buttons
- **Health diagnostics** — poll status, freshness indicators, uptime tracking

---

## Architecture (for contributors)

```
src/
├── index.ts               Entry point
├── bot.ts                 Discord client lifecycle
├── config/                Env validation, constants
├── types/                 TypeScript types (DB, dynmap, alerts, Discord)
├── db/                    postgres.js client + SQL migrations
├── repositories/          Data access layer (10 modules)
├── services/              Business logic (5 modules)
├── workers/               Poller loop + alert dispatch
├── commands/              Slash command handlers (10 modules)
├── events/                Discord event handlers
└── lib/                   Utilities (logger, retry, parser, embeds, pagination)
```

Stack: Node.js, TypeScript (strict mode), discord.js, postgres.js, Zod, Pino, Docker.
