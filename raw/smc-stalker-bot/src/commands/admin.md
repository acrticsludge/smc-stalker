# Module: smc-stalker-bot/src/commands/admin

**Purpose:** Superadmin and guild administration commands — guild management, inspection, whitelist control, access request review, and authentication toggling.

**Source:** smc-stalker-bot/src/commands/admin/

## Key Files
| Path | Purpose | Key Exports |
|------|---------|-------------|
| smc-stalker-bot/src/commands/admin/guilds.ts | /admin guilds — list all guilds, whitelist/blacklist guilds | registerGuildsCommand |
| smc-stalker-bot/src/commands/admin/inspect.ts | /admin inspect — inspect a specific guild's config and users | registerInspectCommand |
| smc-stalker-bot/src/commands/admin/manage-admin.ts | /admin manage-admins — promote/demote guild admins | registerAdminCommands |
| smc-stalker-bot/src/commands/admin/pending-requests.ts | /admin pending — view and manage pending access requests | registerPendingRequestsCommand |
| smc-stalker-bot/src/commands/admin/toggle-auth.ts | /admin toggle-auth — enable/disable auth for a guild | registerToggleAuthCommand |
| smc-stalker-bot/src/commands/admin/whitelist.ts | /admin whitelist — manage guild whitelist (add/remove/list) | registerWhitelistCommands, setWhitelistClient |

## Data Flow
All admin commands require superadmin status (checks `SUPERADMIN_ID`). They interact with `guild.repository.ts`, `guild-user.repository.ts`, `access-request.repository.ts`, and `guild-config.repository.ts`. The whitelist command manages the `is_whitelisted` flag on guilds — non-whitelisted guilds still see commands but get blocked by the auth service. The inspect command reads all guild data (configs, users, roles) and displays a comprehensive summary embed. The pending-requests command shows access requests as interactive buttons (approve/deny) with DM notifications to the requesting user.

## Key Types & Interfaces
- **GuildRow**: Guild record with `is_whitelisted` flag — central to access control.
- **AccessRequestRow**: Pending requests with guild, user, status, and timestamps.
- Uses the interaction-level auth check (`interaction.user.id !== SUPERADMIN_ID`) for all commands.

## Error Handling Patterns
All commands check superadmin status and reject non-superadmin users with a danger embed. DB query failures bubble up to the interaction handler. DM notifications to users (for access request approvals/denials) are wrapped in try/catch — users with DMs disabled silently skip notifications.

## Edge Cases & Gotchas
- The whitelist toggle affects ALL commands for a guild — whitelisting a guild with existing alert configs immediately makes them active; blacklisting immediately blocks all users.
- `toggle-auth` sets a guild-level config key — if the key doesn't exist, auth is enabled by default (conservative default).
- The guild list may show guilds the bot has left (they persist in DB until cleaned) — the bot doesn't auto-remove stale guild records.
- `setWhitelistClient` stores a module-level Discord client reference for DMing users — must be called during bot initialization or DMs silently fail.
