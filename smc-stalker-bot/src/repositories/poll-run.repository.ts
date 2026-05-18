import type { Sql } from 'postgres';
import type { PollRunRow } from '../types/database.js';

export function createPollRunRepository(sql: Sql) {
  return {
    async findById(id: string): Promise<PollRunRow | null> {
      const rows = await sql<PollRunRow[]>`
        SELECT * FROM poll_runs WHERE id = ${id}
      `;
      return rows[0] ?? null;
    },

    async findLatest(limit = 10): Promise<PollRunRow[]> {
      return sql<PollRunRow[]>`
        SELECT * FROM poll_runs ORDER BY started_at DESC LIMIT ${limit}
      `;
    },

    async findLatestSuccessful(): Promise<PollRunRow | null> {
      const rows = await sql<PollRunRow[]>`
        SELECT * FROM poll_runs WHERE success = TRUE ORDER BY started_at DESC LIMIT 1
      `;
      return rows[0] ?? null;
    },

    async create(): Promise<PollRunRow> {
      const rows = await sql<PollRunRow[]>`
        INSERT INTO poll_runs (started_at) VALUES (NOW()) RETURNING *
      `;
      return rows[0]!;
    },

    async complete(
      id: string,
      result: {
        success: boolean;
        errorMessage: string | null;
        townsFound: number;
        townsUpdated: number;
        durationMs: number;
      },
    ): Promise<PollRunRow> {
      const rows = await sql<PollRunRow[]>`
        UPDATE poll_runs SET
          completed_at = NOW(),
          success = ${result.success},
          error_message = ${result.errorMessage},
          towns_found = ${result.townsFound},
          towns_updated = ${result.townsUpdated},
          duration_ms = ${result.durationMs}
        WHERE id = ${id}
        RETURNING *
      `;
      return rows[0]!;
    },

    async countFailedSince(since: Date): Promise<number> {
      const rows = await sql<[{ count: number }]>`
        SELECT COUNT(*)::int AS count FROM poll_runs
        WHERE success = FALSE AND started_at >= ${since}
      `;
      const result = rows[0];
      return result.count;
    },

    async deleteOlderThan(olderThan: Date): Promise<number> {
      const result = await sql`
        DELETE FROM poll_runs WHERE started_at < ${olderThan}
      `;
      return result.count;
    },
  };
}
