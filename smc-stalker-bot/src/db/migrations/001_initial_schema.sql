-- 001_initial_schema.sql
-- Initial schema for SMC Stalker bot

-- ============================================================
-- Guild Management
-- ============================================================

-- Whitelisted Discord guilds
CREATE TABLE guilds (
    id              BIGINT PRIMARY KEY,          -- Discord snowflake
    name            TEXT NOT NULL DEFAULT '',
    is_whitelisted  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Individual Discord users authorized per guild
CREATE TABLE guild_users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id        BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    discord_id      BIGINT NOT NULL,              -- Discord user snowflake
    role            TEXT NOT NULL DEFAULT 'user'
                    CHECK (role IN ('admin', 'user')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(guild_id, discord_id)
);

-- Discord roles authorized per guild
CREATE TABLE guild_roles (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id        BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    role_id         BIGINT NOT NULL,              -- Discord role snowflake
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(guild_id, role_id)
);

-- KV-style per-guild configuration
CREATE TABLE guild_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id        BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    key             TEXT NOT NULL,
    value           JSONB NOT NULL DEFAULT 'null'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(guild_id, key)
);

-- ============================================================
-- Alert Configuration
-- ============================================================

CREATE TABLE alert_configs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id        BIGINT NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    type            TEXT NOT NULL CHECK (type IN ('upkeep', 'friendly', 'enemy')),
    nation_name     TEXT,                         -- NULL = all nations of that category
    channel_id      BIGINT NOT NULL,              -- Discord channel snowflake
    role_id         BIGINT,                       -- Discord role to ping (nullable)
    enabled         BOOLEAN NOT NULL DEFAULT TRUE,
    schedule_times  JSONB NOT NULL DEFAULT '[]'::jsonb,  -- ["HH:MM", ...]
    cooldown_min    INTEGER NOT NULL DEFAULT 60,
    threshold_days  INTEGER NOT NULL DEFAULT 7,
    last_alert_at   TIMESTAMPTZ,                  -- For cooldown evaluation
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Dynmap Data
-- ============================================================

-- Nations derived from dynmap parsing
CREATE TABLE nations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL UNIQUE,
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Towns parsed from dynmap markers
CREATE TABLE towns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL UNIQUE,
    mayor           TEXT NOT NULL DEFAULT '',
    residents       INTEGER NOT NULL DEFAULT 0,
    nation_id       UUID REFERENCES nations(id) ON DELETE SET NULL,
    founded         DATE,
    bank            DECIMAL(12,2) NOT NULL DEFAULT 0,
    upkeep          DECIMAL(10,2) NOT NULL DEFAULT 0,
    last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Historical snapshots for trend analysis
CREATE TABLE town_snapshots (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    town_id         UUID NOT NULL REFERENCES towns(id) ON DELETE CASCADE,
    mayor           TEXT NOT NULL,
    residents       INTEGER NOT NULL,
    nation_id       UUID REFERENCES nations(id) ON DELETE SET NULL,
    bank            DECIMAL(12,2) NOT NULL,
    upkeep          DECIMAL(10,2) NOT NULL,
    snapshot_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Polygon geometry for territory claims
CREATE TABLE territory_shapes (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    town_id         UUID NOT NULL REFERENCES towns(id) ON DELETE CASCADE,
    region_index    INTEGER NOT NULL DEFAULT 0,
    marker_key      TEXT NOT NULL,
    shape           JSONB NOT NULL,               -- [{x: number, z: number}, ...]
    holes           JSONB NOT NULL DEFAULT '[]'::jsonb,
    shape_y         DOUBLE PRECISION NOT NULL DEFAULT 64,
    snapshotted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Poll Tracking
-- ============================================================

CREATE TABLE poll_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ,
    success         BOOLEAN NOT NULL DEFAULT FALSE,
    error_message   TEXT,
    towns_found     INTEGER NOT NULL DEFAULT 0,
    towns_updated   INTEGER NOT NULL DEFAULT 0,
    duration_ms     INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_guild_users_guild_id ON guild_users(guild_id);
CREATE INDEX idx_guild_users_discord_id ON guild_users(discord_id);
CREATE INDEX idx_guild_roles_guild_id ON guild_roles(guild_id);
CREATE INDEX idx_guild_configs_guild_id ON guild_configs(guild_id);
CREATE INDEX idx_alert_configs_guild_id ON alert_configs(guild_id);
CREATE INDEX idx_towns_nation_id ON towns(nation_id);
CREATE INDEX idx_towns_name ON towns(name);
CREATE INDEX idx_town_snapshots_town_id ON town_snapshots(town_id);
CREATE INDEX idx_town_snapshots_snapshot_at ON town_snapshots(snapshot_at);
CREATE INDEX idx_territory_shapes_town_id ON territory_shapes(town_id);
CREATE INDEX idx_territory_shapes_marker_key ON territory_shapes(marker_key);
CREATE UNIQUE INDEX idx_territory_shapes_town_region ON territory_shapes(town_id, region_index);
CREATE INDEX idx_poll_runs_started_at ON poll_runs(started_at);
CREATE INDEX idx_nations_name ON nations(name);
