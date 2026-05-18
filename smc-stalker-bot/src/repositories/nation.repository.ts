import type { Sql } from 'postgres';
import type { NationRow } from '../types/database.js';

export function createNationRepository(sql: Sql) {
  return {
    async findById(id: string): Promise<NationRow | null> {
      const rows = await sql<NationRow[]>`
        SELECT * FROM nations WHERE id = ${id}
      `;
      return rows[0] ?? null;
    },

    async findByName(name: string): Promise<NationRow | null> {
      const rows = await sql<NationRow[]>`
        SELECT * FROM nations WHERE name = ${name}
      `;
      return rows[0] ?? null;
    },

    async findAll(): Promise<NationRow[]> {
      return sql<NationRow[]>`
        SELECT * FROM nations ORDER BY name ASC
      `;
    },

    async upsert(name: string): Promise<NationRow> {
      const rows = await sql<NationRow[]>`
        INSERT INTO nations (name, last_seen_at)
        VALUES (${name}, NOW())
        ON CONFLICT (name) DO UPDATE SET
          last_seen_at = NOW(),
          updated_at = NOW()
        RETURNING *
      `;
      return rows[0]!;
    },

    async markSeen(name: string): Promise<NationRow | null> {
      const rows = await sql<NationRow[]>`
        UPDATE nations SET last_seen_at = NOW(), updated_at = NOW()
        WHERE name = ${name}
        RETURNING *
      `;
      return rows[0] ?? null;
    },

    async delete(id: string): Promise<boolean> {
      const result = await sql`DELETE FROM nations WHERE id = ${id}`;
      return result.count > 0;
    },

    async findStale(olderThan: Date): Promise<NationRow[]> {
      return sql<NationRow[]>`
        SELECT * FROM nations WHERE last_seen_at < ${olderThan}
      `;
    },
  };
}
