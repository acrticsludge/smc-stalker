# Lessons

## 2026-05-19: [Architecture] Per-config nation scoping via nation_pings JSONB

**What happened:** Friendly nation tracking was global — all friendly configs evaluated all friendly nations. Adding a friendly nation with a role ping blindly picked the first matching config. Multiple upkeep configs couldn't target specific nations.

**Root cause:** The original design stored friendly nations in a single `guild_configs` key (`friendly_nations`). The `nation_pings` JSONB column on `alert_configs` existed only for role pings, not for nation membership scoping. The poller (`alert.service.ts`) always referenced the global list.

**Fix:** Reused the existing `nation_pings` JSONB column (`Record<nationName, roleId | null>`) as the per-config nation membership mechanism. When `friendly add` is called with a `config` serial number, the nation is stored in that config's `nation_pings` (not globally). The poller checks `nation_pings` keys first; if present, only evaluates those nations. If empty, falls back to the global list (backward compatible).

**Prevention:** When designing alert/tracking systems with per-config scoping, check if existing JSONB columns can serve dual purposes before adding new tables. The `nation_pings` field was already per-config and JSONB — ideal for storing nation membership without schema changes.

## 2026-05-19: [Bug] URL-encode special characters in DATABASE_URL password

**What happened:** The Discord bot failed to connect to Supabase with `getaddrinfo ENOTFOUND db.zcwitlonfxfbefnmsver.supabase.co` across all operations (guild upsert, commands, poller).

**Root cause:** The `DATABASE_URL` in `.env.local` contained an unescaped `@` in the password (`sovbotweb@605`). The Node.js URL parser treated the second `@` as the delimiter between credentials and hostname, causing the host to be parsed as `605@db.zcwitlonfxfbefnmsver.supabase.co` — a non-existent hostname that fails DNS resolution.

**Fix:** URL-encoded the `@` in the password as `%40`:

```
# Before
DATABASE_URL=postgresql://postgres:password@605@db....supabase.co:5432/postgres

# After
DATABASE_URL=postgresql://postgres:password%40605@db....supabase.co:5432/postgres
```

**Prevention:** Always URL-encode special characters (`@`, `:`, `/`, `%`, `#`, `?`, `&`, `=`, ` `) in database connection string password/user fields. Use `encodeURIComponent()` or a URL builder library rather than string concatenation. When copying connection strings from Supabase dashboard, verify the password contains no unescaped special characters.
