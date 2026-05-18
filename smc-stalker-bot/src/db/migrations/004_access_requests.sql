-- 004_access_requests.sql
-- Tracks user access requests for guilds.

CREATE TABLE IF NOT EXISTS access_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id        BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    user_id         BIGINT NOT NULL,
    user_name       TEXT NOT NULL DEFAULT '',
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'denied')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at     TIMESTAMPTZ,
    UNIQUE(guild_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_access_requests_guild
    ON access_requests(guild_id, status);

CREATE INDEX IF NOT EXISTS idx_access_requests_status
    ON access_requests(status);
