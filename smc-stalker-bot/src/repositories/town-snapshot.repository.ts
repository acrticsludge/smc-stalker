import type { Sql } from 'postgres';
import type { TownSnapshotRow } from '../types/database.js';

export function createTownSnapshotRepository(sql: Sql) {
  return {
    async findByTown(townId: string, limit = 50): Promise<TownSnapshotRow[]> {
      return sql<TownSnapshotRow[]>`
        SELECT * FROM town_snapshots
        WHERE town_id = ${townId}
        ORDER BY snapshot_at DESC
        LIMIT ${limit}
      `;
    },

    async findLatestByTown(townId: string): Promise<TownSnapshotRow | null> {
      const rows = await sql<TownSnapshotRow[]>`
        SELECT * FROM town_snapshots
        WHERE town_id = ${townId}
        ORDER BY snapshot_at DESC
        LIMIT 1
      `;
      return rows[0] ?? null;
    },

    async create(snapshot: {
      townId: string;
      mayor: string;
      residents: number;
      residentNames: string[];
      status: string | null;
      nationId: string | null;
      bank: number;
      upkeep: number;
    }): Promise<TownSnapshotRow> {
      const rows = await sql<TownSnapshotRow[]>`
        INSERT INTO town_snapshots (
          town_id, mayor, residents, resident_names, status,
          nation_id, bank, upkeep
        ) VALUES (
          ${snapshot.townId}, ${snapshot.mayor}, ${snapshot.residents},
          ${sql.array(snapshot.residentNames as [string, ...string[]])},
          ${snapshot.status},
          ${snapshot.nationId}, ${snapshot.bank}, ${snapshot.upkeep}
        )
        RETURNING *
      `;
      return rows[0]!;
    },

    async deleteOlderThan(olderThan: Date): Promise<number> {
      const result = await sql`
        DELETE FROM town_snapshots WHERE snapshot_at < ${olderThan}
      `;
      return result.count;
    },

    async countByTown(townId: string): Promise<number> {
      const rows = await sql<[{ count: number }]>`
        SELECT COUNT(*)::int AS count FROM town_snapshots WHERE town_id = ${townId}
      `;
      const result = rows[0];
      return result.count;
    },
  };
}
