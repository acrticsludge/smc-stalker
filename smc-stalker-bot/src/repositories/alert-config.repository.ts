import type { Sql } from 'postgres';
import type { AlertConfigRow } from '../types/database.js';

export type AlertType = 'upkeep' | 'friendly' | 'enemy';

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase());
}

export function createAlertConfigRepository(sql: Sql) {
  return {
    async findById(id: string): Promise<AlertConfigRow | null> {
      const rows = await sql<AlertConfigRow[]>`
        SELECT * FROM alert_configs WHERE id = ${id}
      `;
      return rows[0] ?? null;
    },

    async findByGuild(guildId: string): Promise<AlertConfigRow[]> {
      return sql<AlertConfigRow[]>`
        SELECT * FROM alert_configs WHERE guild_id = ${guildId} ORDER BY type ASC
      `;
    },

    async findByType(guildId: string, type: AlertType): Promise<AlertConfigRow[]> {
      return sql<AlertConfigRow[]>`
        SELECT * FROM alert_configs
        WHERE guild_id = ${guildId} AND type = ${type}
        ORDER BY created_at ASC
      `;
    },

    async findEnabledByType(type: AlertType): Promise<AlertConfigRow[]> {
      return sql<AlertConfigRow[]>`
        SELECT * FROM alert_configs WHERE type = ${type} AND enabled = TRUE
      `;
    },

    async create(config: {
      guildId: string;
      type: AlertType;
      nationName: string | null;
      channelId: string;
      roleId: string | null;
      nationPings?: Record<string, string | null>;
      scheduleTimes: string[];
      cooldownMin: number;
      thresholdDays: number;
    }): Promise<AlertConfigRow> {
      const rows = await sql<AlertConfigRow[]>`
        INSERT INTO alert_configs (
          guild_id, type, nation_name, channel_id, role_id, nation_pings,
          schedule_times, cooldown_min, threshold_days
        )
        VALUES (
          ${config.guildId}, ${config.type}, ${config.nationName},
          ${config.channelId}, ${config.roleId},
          ${sql.json(config.nationPings ?? {})},
          ${sql.json(config.scheduleTimes)},
          ${config.cooldownMin}, ${config.thresholdDays}
        )
        RETURNING *
      `;
      return rows[0]!;
    },

    async update(
      id: string,
      changes: {
        channelId?: string;
        roleId?: string | null;
        enabled?: boolean;
        scheduleTimes?: string[];
        cooldownMin?: number;
        thresholdDays?: number;
        lastAlertAt?: string | null;
        nationName?: string | null;
        nationPings?: Record<string, string | null>;
      },
    ): Promise<AlertConfigRow | null> {
      const rawEntries = Object.entries(changes);
      const entries = rawEntries.filter(
        (entry): entry is [string, NonNullable<typeof entry[1]>] =>
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          entry[1] !== undefined,
      );

      if (entries.length === 0) {
        return this.findById(id);
      }

      const setEntries = entries.map(([key, value]) => {
        const col = toSnakeCase(key);
        const dbValue = Array.isArray(value) ? JSON.stringify(value) : value;
        return { col, dbValue };
      });

      const setClauses = setEntries
        .map((entry, i) => `${entry.col} = $${i + 1}`)
        .join(', ');

      const values = [...setEntries.map((e) => e.dbValue), id];

      const query = `UPDATE alert_configs SET ${setClauses}, updated_at = NOW() WHERE id = $${entries.length + 1} RETURNING *`;

      const rows = await sql.unsafe<AlertConfigRow[]>(query, values);
      return rows[0] ?? null;
    },

    async delete(id: string): Promise<boolean> {
      const result = await sql`DELETE FROM alert_configs WHERE id = ${id}`;
      return result.count > 0;
    },

    async deleteByGuild(guildId: string): Promise<void> {
      await sql`DELETE FROM alert_configs WHERE guild_id = ${guildId}`;
    },
  };
}
