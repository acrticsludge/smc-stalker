import type { Sql } from 'postgres';
import type { NationResidentSeriesRow } from '../types/database.js';

/**
 * Repository for the nation_resident_series table.
 *
 * Stores one row per nation per calendar day for trend analysis.
 */
export function createNationResidentSeriesRepository(sql: Sql) {
  return {
    /**
     * Upsert a resident count for a nation on a given date.
     */
    async upsert(
      nationId: string,
      snapshotDate: string,
      residents: number,
    ): Promise<NationResidentSeriesRow> {
      const rows = await sql<NationResidentSeriesRow[]>`
        INSERT INTO nation_resident_series (nation_id, snapshot_date, residents)
        VALUES (${nationId}, ${snapshotDate}, ${residents})
        ON CONFLICT (nation_id, snapshot_date) DO UPDATE SET
          residents = EXCLUDED.residents
        RETURNING *
      `;
      return rows[0]!;
    },

    /**
     * Get the resident series for a nation, ordered by date descending.
     */
    async findByNation(
      nationId: string,
      limit = 90,
    ): Promise<NationResidentSeriesRow[]> {
      return sql<NationResidentSeriesRow[]>`
        SELECT * FROM nation_resident_series
        WHERE nation_id = ${nationId}
        ORDER BY snapshot_date DESC
        LIMIT ${limit}
      `;
    },
  };
}
