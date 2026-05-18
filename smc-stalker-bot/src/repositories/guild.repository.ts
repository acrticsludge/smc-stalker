import type { Sql } from 'postgres';
import type { GuildRow } from '../types/database.js';

export function createGuildRepository(sql: Sql) {
  return {
    async findById(id: string): Promise<GuildRow | null> {
      const rows = await sql<GuildRow[]>`
        SELECT * FROM guilds WHERE id = ${id}
      `;
      return rows[0] ?? null;
    },

    async findAll(): Promise<GuildRow[]> {
      return sql<GuildRow[]>`
        SELECT * FROM guilds ORDER BY name ASC
      `;
    },

    async findWhitelisted(): Promise<GuildRow[]> {
      return sql<GuildRow[]>`
        SELECT * FROM guilds WHERE is_whitelisted = TRUE ORDER BY name ASC
      `;
    },

    async upsert(id: string, name: string): Promise<GuildRow> {
      const rows = await sql<GuildRow[]>`
        INSERT INTO guilds (id, name)
        VALUES (${id}, ${name})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          updated_at = NOW()
        RETURNING *
      `;
      return rows[0]!;
    },

    async setWhitelisted(id: string, whitelisted: boolean): Promise<GuildRow> {
      const rows = await sql<GuildRow[]>`
        UPDATE guilds
        SET is_whitelisted = ${whitelisted}, updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
      return rows[0]!;
    },

    async delete(id: string): Promise<void> {
      await sql`DELETE FROM guilds WHERE id = ${id}`;
    },
  };
}
