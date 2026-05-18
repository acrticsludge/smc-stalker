-- 002_resident_tracking.sql
-- Add resident_names and status to snapshots, create daily resident series tables.

-- ============================================================
-- Extend town_snapshots with new dynmap fields
-- ============================================================

ALTER TABLE town_snapshots ADD COLUMN IF NOT EXISTS resident_names TEXT[] DEFAULT '{}';
ALTER TABLE town_snapshots ADD COLUMN IF NOT EXISTS status TEXT;

-- ============================================================
-- Daily resident time series (one row per town per day)
-- Used for trend analysis, charts, and analytics.
-- ============================================================

CREATE TABLE IF NOT EXISTS town_resident_series (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    town_id         UUID NOT NULL REFERENCES towns(id) ON DELETE CASCADE,
    snapshot_date   DATE NOT NULL,
    residents       INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(town_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_town_res_series_town_date
    ON town_resident_series(town_id, snapshot_date);

-- ============================================================
-- Daily nation resident time series (computed from town data)
-- ============================================================

CREATE TABLE IF NOT EXISTS nation_resident_series (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nation_id       UUID NOT NULL REFERENCES nations(id) ON DELETE CASCADE,
    snapshot_date   DATE NOT NULL,
    residents       INTEGER NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(nation_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_nation_res_series_nation_date
    ON nation_resident_series(nation_id, snapshot_date);
