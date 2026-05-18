/**
 * Database row types.
 * Mirrors the schema defined in src/db/migrations/
 */

// ── Guild Management ───────────────────────────────────────

export interface GuildRow {
  id: string;
  name: string;
  is_whitelisted: boolean;
  created_at: string;
  updated_at: string;
}

export interface GuildUserRow {
  id: string;
  guild_id: string;
  discord_id: string;
  role: 'admin' | 'user';
  created_at: string;
}

export interface GuildRoleRow {
  id: string;
  guild_id: string;
  role_id: string;
  created_at: string;
}

export interface GuildConfigRow {
  id: string;
  guild_id: string;
  key: string;
  value: unknown;
  created_at: string;
  updated_at: string;
}

// ── Alert Configuration ────────────────────────────────────

export interface AlertConfigRow {
  id: string;
  guild_id: string;
  type: 'upkeep' | 'friendly' | 'enemy';
  nation_name: string | null;
  channel_id: string;
  role_id: string | null;
  nation_pings: Record<string, string | null>;
  enabled: boolean;
  schedule_times: string[];
  cooldown_min: number;
  threshold_days: number;
  last_alert_at: string | null;
  created_at: string;
  updated_at: string;
}

// ── Dynmap Data ────────────────────────────────────────────

export interface NationRow {
  id: string;
  name: string;
  color: number | null;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface TownRow {
  id: string;
  name: string;
  mayor: string;
  residents: number;
  nation_id: string | null;
  color: number | null;
  founded: string | null;
  bank: number;
  upkeep: number;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface TownSnapshotRow {
  id: string;
  town_id: string;
  mayor: string;
  residents: number;
  resident_names: string[];
  status: string | null;
  nation_id: string | null;
  bank: number;
  upkeep: number;
  snapshot_at: string;
}

export interface ShapeVertex {
  x: number;
  z: number;
}

export interface TerritoryShapeRow {
  id: string;
  town_id: string;
  region_index: number;
  marker_key: string;
  shape: ShapeVertex[];
  holes: ShapeVertex[][];
  shape_y: number;
  snapshotted_at: string;
  created_at: string;
}

// ── Poll Tracking ──────────────────────────────────────────

export interface PollRunRow {
  id: string;
  started_at: string;
  completed_at: string | null;
  success: boolean;
  error_message: string | null;
  towns_found: number;
  towns_updated: number;
  duration_ms: number;
}

// ── Access Requests ─────────────────────────────────────────

export interface AccessRequestRow {
  id: string;
  guild_id: string;
  user_id: string;
  user_name: string;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
  reviewed_at: string | null;
}

// ── Resident Series (Analytics) ────────────────────────────

export interface TownResidentSeriesRow {
  id: string;
  town_id: string;
  snapshot_date: string;
  residents: number;
  created_at: string;
}

export interface NationResidentSeriesRow {
  id: string;
  nation_id: string;
  snapshot_date: string;
  residents: number;
  created_at: string;
}
