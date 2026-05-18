import type { Sql } from 'postgres';
import type { TownRow } from '../types/database.js';

export function createTownRepository(sql: Sql) {
  return {
    async findById(id: string): Promise<TownRow | null> {
      const rows = await sql<TownRow[]>`
        SELECT * FROM towns WHERE id = ${id}
      `;
      return rows[0] ?? null;
    },

    async findByName(name: string): Promise<TownRow | null> {
      const rows = await sql<TownRow[]>`
        SELECT * FROM towns WHERE name = ${name}
      `;
      return rows[0] ?? null;
    },

    async findAll(): Promise<TownRow[]> {
      return sql<TownRow[]>`
        SELECT * FROM towns ORDER BY name ASC
      `;
    },

    async findByNation(nationId: string): Promise<TownRow[]> {
      return sql<TownRow[]>`
        SELECT * FROM towns WHERE nation_id = ${nationId} ORDER BY name ASC
      `;
    },

    async findByNationName(nationName: string): Promise<TownRow[]> {
      return sql<TownRow[]>`
        SELECT t.* FROM towns t
        JOIN nations n ON n.id = t.nation_id
        WHERE n.name = ${nationName}
        ORDER BY t.name ASC
      `;
    },

    async findWithoutNation(): Promise<TownRow[]> {
      return sql<TownRow[]>`
        SELECT * FROM towns WHERE nation_id IS NULL ORDER BY name ASC
      `;
    },

    async upsert(town: {
      name: string;
      mayor: string;
      residents: number;
      nationId: string | null;
      founded: string | null;
      bank: number;
      upkeep: number;
      color?: number | null;
    }): Promise<TownRow> {
      const rows = await sql<TownRow[]>`
        INSERT INTO towns (name, mayor, residents, nation_id, founded, bank, upkeep, color, last_seen_at)
        VALUES (
          ${town.name}, ${town.mayor}, ${town.residents},
          ${town.nationId}, ${town.founded}, ${town.bank},
          ${town.upkeep}, ${town.color ?? null}, NOW()
        )
        ON CONFLICT (name) DO UPDATE SET
          mayor = EXCLUDED.mayor,
          residents = EXCLUDED.residents,
          nation_id = EXCLUDED.nation_id,
          founded = COALESCE(EXCLUDED.founded, towns.founded),
          bank = EXCLUDED.bank,
          upkeep = EXCLUDED.upkeep,
          color = COALESCE(EXCLUDED.color, towns.color),
          last_seen_at = NOW(),
          updated_at = NOW()
        RETURNING *
      `;
      return rows[0]!;
    },

    async delete(id: string): Promise<boolean> {
      const result = await sql`DELETE FROM towns WHERE id = ${id}`;
      return result.count > 0;
    },

    async markStale(olderThan: Date): Promise<number> {
      const result = await sql`
        DELETE FROM towns WHERE last_seen_at < ${olderThan}
      `;
      return result.count;
    },

    async findByBankThreshold(maxUpkeepDays: number): Promise<TownRow[]> {
      return sql<TownRow[]>`
        SELECT * FROM towns
        WHERE upkeep > 0
          AND (bank < 0 OR bank < (upkeep * ${maxUpkeepDays}))
        ORDER BY (bank / NULLIF(upkeep, 0)) ASC
      `;
    },
  };
}
