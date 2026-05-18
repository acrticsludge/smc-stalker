import type { Sql, JSONValue } from 'postgres';
import type { GuildConfigRow } from '../types/database.js';

export function createGuildConfigRepository(sql: Sql) {
  return {
    async get(guildId: string, key: string): Promise<unknown> {
      const rows = await sql<GuildConfigRow[]>`
        SELECT * FROM guild_configs WHERE guild_id = ${guildId} AND key = ${key}
      `;
      return rows[0]?.value ?? null;
    },

    async getTyped<T>(guildId: string, key: string): Promise<T | null> {
      const value = await this.get(guildId, key);
      return value as T | null;
    },

    async getAll(guildId: string): Promise<GuildConfigRow[]> {
      return sql<GuildConfigRow[]>`
        SELECT * FROM guild_configs WHERE guild_id = ${guildId} ORDER BY key ASC
      `;
    },

    async set(guildId: string, key: string, value: JSONValue): Promise<GuildConfigRow> {
      const rows = await sql<GuildConfigRow[]>`
        INSERT INTO guild_configs (guild_id, key, value)
        VALUES (${guildId}, ${key}, ${sql.json(value)})
        ON CONFLICT (guild_id, key) DO UPDATE SET
          value = EXCLUDED.value,
          updated_at = NOW()
        RETURNING *
      `;
      return rows[0]!;
    },

    async delete(guildId: string, key: string): Promise<boolean> {
      const result = await sql`
        DELETE FROM guild_configs WHERE guild_id = ${guildId} AND key = ${key}
      `;
      return result.count > 0;
    },

    async deleteByGuild(guildId: string): Promise<void> {
      await sql`DELETE FROM guild_configs WHERE guild_id = ${guildId}`;
    },
  };
}
