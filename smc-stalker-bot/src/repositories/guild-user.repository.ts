import type { Sql } from 'postgres';
import type { GuildUserRow } from '../types/database.js';

export function createGuildUserRepository(sql: Sql) {
  return {
    async findByGuild(guildId: string): Promise<GuildUserRow[]> {
      return sql<GuildUserRow[]>`
        SELECT * FROM guild_users WHERE guild_id = ${guildId} ORDER BY created_at ASC
      `;
    },

    async findInGuild(guildId: string, discordId: string): Promise<GuildUserRow | null> {
      const rows = await sql<GuildUserRow[]>`
        SELECT * FROM guild_users WHERE guild_id = ${guildId} AND discord_id = ${discordId}
      `;
      return rows[0] ?? null;
    },

    async findAdminByDiscordId(discordId: string): Promise<GuildUserRow | null> {
      const rows = await sql<GuildUserRow[]>`
        SELECT * FROM guild_users WHERE discord_id = ${discordId} AND role = 'admin'
        LIMIT 1
      `;
      return rows[0] ?? null;
    },

    async add(guildId: string, discordId: string, role: 'admin' | 'user'): Promise<GuildUserRow> {
      const rows = await sql<GuildUserRow[]>`
        INSERT INTO guild_users (guild_id, discord_id, role)
        VALUES (${guildId}, ${discordId}, ${role})
        ON CONFLICT (guild_id, discord_id) DO UPDATE SET role = EXCLUDED.role
        RETURNING *
      `;
      return rows[0]!;
    },

    async remove(guildId: string, discordId: string): Promise<boolean> {
      const result = await sql`
        DELETE FROM guild_users WHERE guild_id = ${guildId} AND discord_id = ${discordId}
      `;
      return result.count > 0;
    },

    async removeByGuild(guildId: string): Promise<void> {
      await sql`DELETE FROM guild_users WHERE guild_id = ${guildId}`;
    },
  };
}
