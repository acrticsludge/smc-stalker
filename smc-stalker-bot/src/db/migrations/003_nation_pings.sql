-- 003_nation_pings.sql
-- Add per-nation role pings to alert_configs.

ALTER TABLE alert_configs ADD COLUMN IF NOT EXISTS nation_pings JSONB NOT NULL DEFAULT '{}'::jsonb;
-- nation_pings stores a map of nation_name → role_id (string or null):
-- {"Iberia": "123456789012345678", "Cultist_Empire": null}
