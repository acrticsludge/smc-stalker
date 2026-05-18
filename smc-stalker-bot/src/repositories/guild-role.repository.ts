import type { Sql } from 'postgres';
import type { GuildRoleRow } from '../types/database.js';

export function createGuildRoleRepository(sql: Sql) {
  return {
    async findByGuild(guildId: string): Promise<GuildRoleRow[]> {
      return sql<GuildRoleRow[]>`
        SELECT * FROM guild_roles WHERE guild_id = ${guildId} ORDER BY created_at ASC
      `;
    },

    async findInGuild(guildId: string, roleId: string): Promise<GuildRoleRow | null> {
      const rows = await sql<GuildRoleRow[]>`
        SELECT * FROM guild_roles WHERE guild_id = ${guildId} AND role_id = ${roleId}
      `;
      return rows[0] ?? null;
    },

    async add(guildId: string, roleId: string): Promise<GuildRoleRow> {
      const rows = await sql<GuildRoleRow[]>`
        INSERT INTO guild_roles (guild_id, role_id)
        VALUES (${guildId}, ${roleId})
        ON CONFLICT (guild_id, role_id) DO NOTHING
        RETURNING *
      `;
      return rows[0]!;
    },

    async remove(guildId: string, roleId: string): Promise<boolean> {
      const result = await sql`
        DELETE FROM guild_roles WHERE guild_id = ${guildId} AND role_id = ${roleId}
      `;
      return result.count > 0;
    },

    async removeByGuild(guildId: string): Promise<void> {
      await sql`DELETE FROM guild_roles WHERE guild_id = ${guildId}`;
    },

    async roleExistsInGuild(guildId: string, roleId: string): Promise<boolean> {
      const rows = await sql<[{ exists: boolean }]>`
        SELECT EXISTS(
          SELECT 1 FROM guild_roles WHERE guild_id = ${guildId} AND role_id = ${roleId}
        ) AS exists
      `;
      const result = rows[0];
      return result.exists;
    },
  };
}
