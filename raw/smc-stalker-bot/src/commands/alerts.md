# Module: smc-stalker-bot/src/commands/alerts

**Purpose:** Alert configuration and viewing commands — create and manage upkeep, friendly, and enemy alert configs with paginated overviews.

**Source:** smc-stalker-bot/src/commands/alerts/

## Key Files
| Path | Purpose | Key Exports |
|------|---------|-------------|
| smc-stalker-bot/src/commands/alerts/configure.ts | /alert-configure — full subcommand group for creating upkeep/friendly/enemy alerts | registerAlertConfigureCommand |
| smc-stalker-bot/src/commands/alerts/status.ts | /alert-status — list all alert configs for the guild | registerAlertStatusCommand |
| smc-stalker-bot/src/commands/alerts/view.ts | /alerts — rich paginated embed view of all configs with tracked nations | registerAlertsViewCommand |

## Data Flow
All three commands interact with the `alert-config.repository.ts` for CRUD operations. `registerAlertConfigureCommand` provides a multi-level subcommand group (upkeep create/remove/list, friendly create/remove/add-nation/list, enemy create/remove/list). `registerAlertsViewCommand` builds rich embeds with pagination buttons (previous/next, 120s timeout). Alert configs include channel, schedule times, cooldown, threshold days, nation pings for role mentions, and enabled/disabled toggle.

## Key Types & Interfaces
- **AlertConfigRow**: The database row type driving all alert config display and editing.
- Uses pagination system (`ComponentType.Button`, `ActionRowBuilder`) from discord.js for multi-page embed navigation.

## Error Handling Patterns
Auth checks at the top of each command (via `getAuth`) deny unauthorized users with a danger embed. Empty states show info embeds rather than errors. Config lookups by position number validate bounds and return a "not found" error embed for out-of-range positions.

## Edge Cases & Gotchas
- The view command uses ephemeral pagination with a 120-second collector timeout — after timeout, pagination buttons become non-functional (Discord automatically disables them).
- Friendly alert configs support `nation_pings` mapping (nation name → role ID) — the view command displays these as clickable role mentions.
- Config creation validates required fields at the Discord option level but doesn't validate business logic (e.g., overlapping schedules, duplicate nation pings).
- The `alert-configure` command uses nested subcommand groups — users must navigate a complex command hierarchy in Discord's autocomplete UI.
