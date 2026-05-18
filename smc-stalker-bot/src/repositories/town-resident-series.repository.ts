import type { Sql } from 'postgres';
import type { TownResidentSeriesRow } from '../types/database.js';

/**
 * Repository for the town_resident_series table.
 *
 * Stores one row per town per calendar day for trend analysis.
 */
export function createTownResidentSeriesRepository(sql: Sql) {
  return {
    /**
     * Upsert a resident count for a town on a given date.
     * If a row already exists for (town_id, snapshot_date), it is updated.
     */
    async upsert(
      townId: string,
      snapshotDate: string,
      residents: number,
    ): Promise<TownResidentSeriesRow> {
      const rows = await sql<TownResidentSeriesRow[]>`
        INSERT INTO town_resident_series (town_id, snapshot_date, residents)
        VALUES (${townId}, ${snapshotDate}, ${residents})
        ON CONFLICT (town_id, snapshot_date) DO UPDATE SET
          residents = EXCLUDED.residents
        RETURNING *
      `;
      return rows[0]!;
    },

    /**
     * Get the resident series for a town, ordered by date ascending.
     */
    async findByTown(
      townId: string,
      limit = 90,
    ): Promise<TownResidentSeriesRow[]> {
      return sql<TownResidentSeriesRow[]>`
        SELECT * FROM town_resident_series
        WHERE town_id = ${townId}
        ORDER BY snapshot_date DESC
        LIMIT ${limit}
      `;
    },
  };
}
