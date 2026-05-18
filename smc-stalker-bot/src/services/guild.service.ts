/**
 * Guild management service.
 *
 * Handles whitelist management, admin management, and guild configuration.
 * These operations are only available to the superadmin.
 */

import type { Sql } from 'postgres';
import { createGuildRepository } from '../repositories/guild.repository.js';
import { createGuildUserRepository } from '../repositories/guild-user.repository.js';
import { createGuildRoleRepository } from '../repositories/guild-role.repository.js';
import { createGuildConfigRepository } from '../repositories/guild-config.repository.js';
import type { GuildRow, GuildUserRow, GuildRoleRow, GuildConfigRow } from '../types/database.js';

export function createGuildService(sql: Sql) {
  const guildRepo = createGuildRepository(sql);
  const userRepo = createGuildUserRepository(sql);
  const roleRepo = createGuildRoleRepository(sql);
  const configRepo = createGuildConfigRepository(sql);

  // ── Whitelist Management ─────────────────────────────

  async function whitelistGuild(guildId: string, name: string): Promise<GuildRow> {
    return guildRepo.upsert(guildId, name);
  }

  async function removeGuild(guildId: string): Promise<void> {
    await guildRepo.delete(guildId);
  }

  async function setWhitelisted(guildId: string, whitelisted: boolean): Promise<GuildRow> {
    return guildRepo.setWhitelisted(guildId, whitelisted);
  }

  async function listWhitelisted(): Promise<GuildRow[]> {
    return guildRepo.findWhitelisted();
  }

  // ── Admin Management ─────────────────────────────────

  async function addAdmin(guildId: string, discordId: string): Promise<GuildUserRow> {
    return userRepo.add(guildId, discordId, 'admin');
  }

  async function removeAdmin(guildId: string, discordId: string): Promise<boolean> {
    return userRepo.remove(guildId, discordId);
  }

  async function listAdmins(guildId: string): Promise<GuildUserRow[]> {
    const users = await userRepo.findByGuild(guildId);
    return users.filter((u) => u.role === 'admin');
  }

  // ── Guild Inspection ─────────────────────────────────

  async function inspectGuild(guildId: string): Promise<{
    guild: GuildRow | null;
    admins: GuildUserRow[];
    roles: GuildRoleRow[];
    configs: GuildConfigRow[];
  }> {
    const [guild, admins, roles, configs] = await Promise.all([
      guildRepo.findById(guildId),
      listAdmins(guildId),
      roleRepo.findByGuild(guildId),
      configRepo.getAll(guildId),
    ]);

    return { guild, admins, roles, configs };
  }

  // ── Guild Config ─────────────────────────────────────

  async function setConfig(
    guildId: string,
    key: string,
    value: unknown,
  ): Promise<GuildConfigRow> {
    return configRepo.set(guildId, key, value as Parameters<typeof configRepo.set>[2]);
  }

  async function getConfig(guildId: string, key: string): Promise<unknown> {
    return configRepo.get(guildId, key);
  }

  async function deleteConfig(guildId: string, key: string): Promise<boolean> {
    return configRepo.delete(guildId, key);
  }

  return {
    whitelistGuild,
    removeGuild,
    setWhitelisted,
    listWhitelisted,
    addAdmin,
    removeAdmin,
    listAdmins,
    inspectGuild,
    setConfig,
    getConfig,
    deleteConfig,
  };
}
