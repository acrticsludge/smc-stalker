# Module: smc-stalker-bot/src/commands/upkeep

**Purpose:** Upkeep monitoring commands — query towns at risk of bankruptcy, list towns by nation, and view detailed town/nation upkeep status.

**Source:** smc-stalker-bot/src/commands/upkeep/

## Key Files
| Path | Purpose | Key Exports |
|------|---------|-------------|
| smc-stalker-bot/src/commands/upkeep/at-risk.ts | /upkeep at-risk — towns below bank threshold | registerAtRiskCommand |
| smc-stalker-bot/src/commands/upkeep/list.ts | /upkeep list — list towns (all, by nation, unclaimed) | registerListCommands |
| smc-stalker-bot/src/commands/upkeep/town.ts | /upkeep town — detailed town upkeep status | registerUpkeepTownCommand |
| smc-stalker-bot/src/commands/upkeep/nation.ts | /upkeep nation — nation-wide upkeep overview | registerUpkeepNationCommand |

## Data Flow
Uses `town.repository.ts` `findByBankThreshold` to compute at-risk towns (bank <= upkeep * N days). Each command reads from the DB via repository methods and formats results into Discord embeds. The at-risk command uses the alert service's threshold logic to show which towns will expire within a user-specified number of days. List commands support filtering by nation name or showing unclaimed towns (no nation).

## Key Types & Interfaces
- Uses `TownRow` from database types — displays bank, upkeep, nation, residents.
- Uses `UpkeepAlertTown` from alert types for at-risk display.

## Error Handling Patterns
Each command handler wraps execution in try/catch at the interaction level (`interaction-create.ts`). DB query failures bubble up as unhandled errors to the interaction handler's catch block. Paginated responses handle edge cases where query returns zero results gracefully (empty state embeds).

## Edge Cases & Gotchas
- `findByBankThreshold` excludes towns with zero upkeep — these towns never appear in at-risk results.
- Nation name lookups are case-sensitive (SQL `=` comparison) — users must match the exact nation name from Dynmap.
- The "unclaimed" filter shows towns with `nation_id IS NULL` — towns whose nation was deleted are counted here.
- Large servers with hundreds of towns may hit Discord's 2000-char embed limit — pagination is used for list commands.
