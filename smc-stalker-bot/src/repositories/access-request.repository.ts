import type { Sql } from 'postgres';
import type { AccessRequestRow } from '../types/database.js';

export function createAccessRequestRepository(sql: Sql) {
  return {
    async findById(id: string): Promise<AccessRequestRow | null> {
      const rows = await sql<AccessRequestRow[]>`
        SELECT * FROM access_requests WHERE id = ${id}
      `;
      return rows[0] ?? null;
    },

    async findPendingByGuild(guildId: string): Promise<AccessRequestRow[]> {
      return sql<AccessRequestRow[]>`
        SELECT * FROM access_requests
        WHERE guild_id = ${guildId} AND status = 'pending'
        ORDER BY created_at ASC
      `;
    },

    async findAllPending(): Promise<AccessRequestRow[]> {
      return sql<AccessRequestRow[]>`
        SELECT * FROM access_requests WHERE status = 'pending' ORDER BY created_at ASC
      `;
    },

    async findByUser(guildId: string, userId: string): Promise<AccessRequestRow | null> {
      const rows = await sql<AccessRequestRow[]>`
        SELECT * FROM access_requests
        WHERE guild_id = ${guildId} AND user_id = ${userId}
      `;
      return rows[0] ?? null;
    },

    async create(guildId: string, userId: string, userName: string): Promise<AccessRequestRow> {
      const rows = await sql<AccessRequestRow[]>`
        INSERT INTO access_requests (guild_id, user_id, user_name)
        VALUES (${guildId}, ${userId}, ${userName})
        ON CONFLICT (guild_id, user_id) DO UPDATE SET
          status = 'pending',
          reviewed_at = NULL,
          user_name = EXCLUDED.user_name
        RETURNING *
      `;
      return rows[0]!;
    },

    async approve(id: string): Promise<AccessRequestRow | null> {
      const rows = await sql<AccessRequestRow[]>`
        UPDATE access_requests
        SET status = 'approved', reviewed_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
      return rows[0] ?? null;
    },

    async deny(id: string): Promise<AccessRequestRow | null> {
      const rows = await sql<AccessRequestRow[]>`
        UPDATE access_requests
        SET status = 'denied', reviewed_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;
      return rows[0] ?? null;
    },
  };
}
