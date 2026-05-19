# Module: smc-stalker-bot/src/types

**Purpose:** Central type definitions for the entire Discord bot — database row shapes, alert payloads, Dynmap API responses, and Discord command structures.

**Source:** smc-stalker-bot/src/types/

## Key Files
| Path | Purpose | Key Exports |
|------|---------|-------------|
| smc-stalker-bot/src/types/database.ts | All database row types mirroring the schema | GuildRow, GuildUserRow, GuildRoleRow, GuildConfigRow, AlertConfigRow, NationRow, TownRow, TownSnapshotRow, TerritoryShapeRow, PollRunRow, AccessRequestRow, TownResidentSeriesRow, NationResidentSeriesRow |
| smc-stalker-bot/src/types/alerts.ts | Alert category, payload, and change types | AlertCategory, UpkeepAlertTown, EnemyChange, UpkeepAlertPayload, EnemyAlertPayload, AlertPayload |
| smc-stalker-bot/src/types/dynmap.ts | Dynmap markers.json API response shapes | DynmapColor, DynmapVertex, DynmapPosition, DynmapMarker, DynmapMarkerSet, DynmapResponse, ParsedTownData, DynmapPollResult, TownShapeData |
| smc-stalker-bot/src/types/discord.ts | Discord command definitions and auth context | CommandDefinition, ContextMenuCommandDefinition, GuildCommandMap, AuthContext |

## Data Flow
Pure type definitions — no runtime logic. Imported by all other modules (services, repositories, commands, events). Database types mirror the Postgres schema; Dynmap types model the external Dynmap markers.json API. Discord types define the interface contract between command registration and execution.

## Key Types & Interfaces
- **AlertConfigRow**: Central alert configuration — guild, nation, channel, schedule, cooldown, threshold. Drives all alert logic.
- **ParsedTownData & TownSnapshotRow**: Core domain models — parsed from Dynmap HTML and stored as snapshots for historical tracking.
- **AuthContext**: Authorization result with 5 boolean flags (superadmin, whitelisted, guild admin, authorized user/role).
- **DynmapResponse**: Top-level API response with chunky/outskirts/townybluemap_claims marker sets.
- **CommandDefinition**: Generic slash command type with typed data + execute + optional autocomplete.

## Error Handling Patterns
No error handling — these are pure interfaces and type aliases with no runtime code.

## Edge Cases & Gotchas
- `AlertConfigRow.nation_pings` uses `Record<string, string | null>` — null values mean "no role ping for that nation" while a string is a role ID. Consumers must handle both.
- `TownRow.founded` is nullable — new towns may not have a founded date in Dynmap output; the parser returns null for unparseable dates.
- `AlertPayload` is a discriminated union — type narrowing on `alertType` is required before accessing `towns` vs `changes`.
- `GuildConfigRow.value` is `unknown` — consumers must cast/validate at runtime.
- Territory `holes` are arrays of vertex arrays (polygon rings), not flattened — external consumers of Dynmap shapes must handle this nesting.
