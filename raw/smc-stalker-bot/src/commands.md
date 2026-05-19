# Module: smc-stalker-bot/src/commands

**Purpose:** Root command module — command registry, Discord REST API deployment, and top-level command definitions (access, help, player).

**Source:** smc-stalker-bot/src/commands/

## Key Files
| Path | Purpose | Key Exports |
|------|---------|-------------|
| smc-stalker-bot/src/commands/index.ts | Command map initialization and routing | setDiscordClient, registerAllCommands, defineCommand, getCommand |
| smc-stalker-bot/src/commands/register.ts | Discord REST API command deployment per guild | registerAccessCommand, registerHelpCommand, registerPlayerCommand, deployCommands |
| smc-stalker-bot/src/commands/access.ts | /access command — guild access request workflow | registerAccessCommand |
| smc-stalker-bot/src/commands/help.ts | /help command — list available commands | registerHelpCommand |
| smc-stalker-bot/src/commands/player.ts | /player command — player lookup | registerPlayerCommand |

## Data Flow
`index.ts` initializes a `Map<string, CommandDefinition>` of registered slash commands. `registerAllCommands` aggregates subcommands from upkeep/, alerts/, admin/ plus the root-level commands. `getCommand` is called by the interaction handler to look up and execute commands. `register.ts` provides `deployCommands` which uses Discord REST API to upsert slash commands for a specific guild. The `setDiscordClient` function stores the client reference for use by cross-module features like DM notifications.

## Key Types & Interfaces
- **CommandDefinition**: Slash command shape with `data` (SlashCommandBuilder), `execute` (handler), optional `autocomplete`.

## Error Handling Patterns
`deployCommands` wraps each guild's deployment in try/catch — one guild failure doesn't prevent others from getting commands. Command registration failures are logged but don't crash the bot.

## Edge Cases & Gotchas
- Commands are deployed per-guild, not globally — this means guilds added after bot startup don't get commands until the next ready event (bot restart).
- The command map is a singleton — calling `registerAllCommands` twice would duplicate entries.
- `setDiscordClient` is used by admin commands for DMing users — if the client reference is stale (after reconnect), DMs silently fail.
