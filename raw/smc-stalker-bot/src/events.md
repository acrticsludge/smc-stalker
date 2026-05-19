# Module: smc-stalker-bot/src/events

**Purpose:** Discord client event handlers — bot ready (guild sync, command deploy) and interaction create (command dispatch, access request buttons).

**Source:** smc-stalker-bot/src/events/

## Key Files
| Path | Purpose | Key Exports |
|------|---------|-------------|
| smc-stalker-bot/src/events/ready.ts | Bot ready handler — upserts guilds, deploys commands to all guilds | handleReady |
| smc-stalker-bot/src/events/interaction-create.ts | Interaction router — slash commands (auth check + execute) and button access requests | handleInteraction, setInteractionClient |

## Data Flow
`ready.ts` fires once when the bot connects to Discord. It upserts all cached guilds into the DB, then deploys slash commands to every guild via the Discord REST API. `interaction-create.ts` routes incoming interactions: slash commands go through defer → auth check (`checkAuthorization`) → command execution; button interactions handle access request approvals/denials (superadmin-only). Auth failures and unknown commands get ephemeral error embeds.

## Key Types & Interfaces
- **Interaction**: Discord.js interaction union type — dispatched to command or button handler based on type.
- **DiscordAPIError**: Discord API error type — error code 10062 (Unknown Interaction) is handled gracefully.

## Error Handling Patterns
Interaction-level error handling with grace: expired interactions (Discord error 10062) are logged and silently dropped. Command execution errors catch at the top level, log, and reply with a generic danger embed. If the error reply itself fails, it's logged as a warning — never crashes. Button handler DMs to users are wrapped in try/catch with fallback logging (user may have DMs disabled).

## Edge Cases & Gotchas
- `interaction.deferReply()` must be called before `checkAuthorization` — auth queries can be slow and Discord requires acknowledgment within 3 seconds.
- Button interactions for access requests check `interaction.user.id !== SUPERADMIN_ID` — only the hardcoded superadmin can approve/deny.
- `setInteractionClient` stores a module-level reference for DMing users — if not called before button handler runs, DM notifications silently fail.
- The ready event handler does NOT remove guilds that the bot has left — stale guild records persist in the DB until cleaned up manually.
