# CLAUDE.local.md

Behavioral guidelines and project context for the SovereignMC upkeep Discord bot.

---

# Project Overview

Production-grade multi-guild Discord upkeep bot for Minecraft Towny-style dynmap servers.

Core responsibilities:

- poll dynmap globally
- parse town/nation/upkeep data
- store historical territory data
- manage upkeep alerts
- support isolated multi-guild configurations

Dynmap endpoint:
https://map.sovereignmc.net/maps/world/live/markers.json

---

# Behavioral Rules

## Think Before Coding

Never assume requirements silently.

Before implementation:

- state assumptions
- identify ambiguities
- present tradeoffs
- ask clarifying questions

Do not blindly implement speculative systems.

---

## Simplicity First

Minimum code necessary.

Do not:

- overabstract
- introduce speculative flexibility
- create systems not requested
- build future features prematurely

Prefer:

- explicit code
- readable services
- straightforward flows

---

## Surgical Changes

Touch only required code.

Avoid:

- unrelated refactors
- formatting churn
- architecture rewrites outside scope

Remove only dead code introduced by your own changes.

---

# Tech Stack

Mandatory:

- Node.js
- TypeScript strict mode
- discord.js
- Supabase
- Docker
- Zod
- ESLint
- Prettier

---

# Architecture Rules

ONLY hardcoded value allowed:

Discord superadmin ID:
701660839299776593

Everything else must be:

- database-driven
- env-driven
- configuration-driven

Never hardcode:

- guild IDs
- role IDs
- channels
- nation names
- alert settings
- dynmap configs

---

# Multi Guild Rules

Guilds are fully isolated.

Each guild has separate:

- users
- permissions
- alert configs
- tracked nations
- settings

No global user authorization except superadmin.

---

# Polling Rules

Global polling ONLY.

Do not create per-guild pollers.

Poll every 5 minutes.

Requirements:

- retry handling
- stale detection
- parser validation
- structured logging
- graceful failures

Every alert/status embed should include:

- last successful poll
- next poll
- cache freshness

---

# Database Standards

Use relational schema design.

Expected entities:

- guilds
- guild_users
- guild_roles
- guild_configs
- towns
- nations
- snapshots
- poll_runs
- territory_shapes

Use:

- indexes
- foreign keys
- timestamps
- constraints

Store:

- historical snapshots
- polygon geometry
- territory shapes

---

# Command Standards

Slash commands only.

Commands:

- validate with Zod
- contain no business logic
- use services only
- never access DB directly

---

# TypeScript Standards

STRICT MODE REQUIRED.

Forbidden:

- any
- ts-ignore
- giant god files
- duplicated logic

Prefer:

- discriminated unions
- typed repositories
- typed DTOs
- typed env validation

---

# Logging + Errors

Requirements:

- structured logs
- no silent failures
- retry wrappers
- graceful Discord API handling
- graceful dynmap failure handling

Never expose secrets in logs.

---

# Docker

Must include:

- Dockerfile
- docker-compose
- production-safe env handling

---

# Development Workflow

Before coding:

1. analyze architecture
2. analyze schema
3. propose implementation plan
4. identify risks
5. ask clarifying questions

After implementation:

- self-review
- simplify where possible
- identify tech debt

---

# Project Scope

This project is:

- backend infrastructure
- Discord bot
- polling + alert system

This project is NOT:

- a web dashboard
- OAuth platform
- analytics frontend
- microservice architecture

Stay focused.

---

# Folder Structure Guidance

Expected structure:

src/
commands/
services/
repositories/
workers/
jobs/
events/
lib/
validators/
db/
config/
types/

Avoid:

- dumping everything in utils/
- giant command files
- mixed responsibilities

---

# Quality Standard

This should feel like production backend software, not a hobby Discord bot.

Optimize for:

- maintainability
- clarity
- scalability
- operational reliability
