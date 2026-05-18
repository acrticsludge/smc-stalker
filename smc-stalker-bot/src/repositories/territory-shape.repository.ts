import type { Sql, JSONValue } from 'postgres';
import type { TerritoryShapeRow, ShapeVertex } from '../types/database.js';

export function createTerritoryShapeRepository(sql: Sql) {
  return {
    async findByTown(townId: string): Promise<TerritoryShapeRow[]> {
      return sql<TerritoryShapeRow[]>`
        SELECT * FROM territory_shapes
        WHERE town_id = ${townId}
        ORDER BY region_index ASC
      `;
    },

    async findLatestByTown(townId: string): Promise<TerritoryShapeRow | null> {
      const rows = await sql<TerritoryShapeRow[]>`
        SELECT * FROM territory_shapes
        WHERE town_id = ${townId}
        ORDER BY snapshotted_at DESC
        LIMIT 1
      `;
      return rows[0] ?? null;
    },

    async upsert(shape: {
      townId: string;
      regionIndex: number;
      markerKey: string;
      shape: ShapeVertex[];
      holes: ShapeVertex[][];
      shapeY: number;
    }): Promise<TerritoryShapeRow> {
      const rows = await sql<TerritoryShapeRow[]>`
        INSERT INTO territory_shapes (town_id, region_index, marker_key, shape, holes, shape_y, snapshotted_at)
        VALUES (
          ${shape.townId}, ${shape.regionIndex}, ${shape.markerKey},
          ${sql.json(shape.shape as unknown as JSONValue)}, ${sql.json(shape.holes as unknown as JSONValue)},
          ${shape.shapeY}, NOW()
        )
        ON CONFLICT (town_id, region_index) DO UPDATE SET
          marker_key = EXCLUDED.marker_key,
          shape = EXCLUDED.shape,
          holes = EXCLUDED.holes,
          shape_y = EXCLUDED.shape_y,
          snapshotted_at = NOW()
        RETURNING *
      `;
      return rows[0]!;
    },

    async deleteByTown(townId: string): Promise<void> {
      await sql`DELETE FROM territory_shapes WHERE town_id = ${townId}`;
    },

    async deleteOlderThan(olderThan: Date): Promise<number> {
      const result = await sql`
        DELETE FROM territory_shapes WHERE snapshotted_at < ${olderThan}
      `;
      return result.count;
    },
  };
}
