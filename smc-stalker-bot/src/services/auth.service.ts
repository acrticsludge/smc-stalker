/**
 * Authorization service.
 *
 * Determines if a user is authorized to use the bot in a given guild.
 * Only the superadmin has global access. All other access is guild-scoped.
 */

import type { ChatInputCommandInteraction } from 'discord.js';
import type { Sql } from 'postgres';
import { SUPERADMIN_ID } from '../config/constants.js';
import { createGuildRepository } from '../repositories/guild.repository.js';
import { createGuildUserRepository } from '../repositories/guild-user.repository.js';
import { createGuildRoleRepository } from '../repositories/guild-role.repository.js';

export interface AuthResult {
  authorized: boolean;
  reason: string;
  isSuperAdmin: boolean;
  isGuildAdmin: boolean;
  guildId: string | null;
}

// ── Per-interaction auth cache ──────────────────────────

const authCache = new WeakMap<ChatInputCommandInteraction, AuthResult>();

/**
 * Store auth result for an interaction (called by interaction handler).
 */
export function setAuth(
  interaction: ChatInputCommandInteraction,
  auth: AuthResult,
): void {
  authCache.set(interaction, auth);
}

/**
 * Retrieve the auth result stored for an interaction.
 * Returns null if the interaction wasn't checked yet.
 */
export function getAuth(
  interaction: ChatInputCommandInteraction,
): AuthResult | null {
  return authCache.get(interaction) ?? null;
}

/**
 * Check if a user is authorized to use the bot in their current guild.
 *
 * Authorization levels (first match wins):
 *  1. Superadmin → full access to everything
 *  2. Guild whitelisted AND user is guild admin → access
 *  3. Guild whitelisted AND user has authorized role → access
 *  4. Guild whitelisted AND user is individually authorized → access
 *  5. Otherwise → denied
 */
export async function checkAuthorization(
  interaction: ChatInputCommandInteraction,
  sql: Sql,
): Promise<AuthResult> {
  const userId = interaction.user.id;
  const guildId = interaction.guildId;

  // Check superadmin (global access)
  if (userId === SUPERADMIN_ID) {
    const result: AuthResult = {
      authorized: true,
      reason: 'Superadmin access',
      isSuperAdmin: true,
      isGuildAdmin: true,
      guildId,
    };
    setAuth(interaction, result);
    return result;
  }

  // Commands in DMs without a guild
  if (!guildId) {
    const result: AuthResult = {
      authorized: false,
      reason: 'Bot commands are only available in Discord servers.',
      isSuperAdmin: false,
      isGuildAdmin: false,
      guildId: null,
    };
    setAuth(interaction, result);
    return result;
  }

  const guildRepo = createGuildRepository(sql);
  const userRepo = createGuildUserRepository(sql);
  const roleRepo = createGuildRoleRepository(sql);

  // Check guild is whitelisted
  const guild = await guildRepo.findById(guildId);
  if (!guild?.is_whitelisted) {
    const result: AuthResult = {
      authorized: false,
      reason: 'This server is not whitelisted. Contact the bot superadmin.',
      isSuperAdmin: false,
      isGuildAdmin: false,
      guildId,
    };
    setAuth(interaction, result);
    return result;
  }

  // Check if user is a guild admin
  const guildUser = await userRepo.findInGuild(guildId, userId);
  if (guildUser?.role === 'admin') {
    const result: AuthResult = {
      authorized: true,
      reason: 'Guild admin access',
      isSuperAdmin: false,
      isGuildAdmin: true,
      guildId,
    };
    setAuth(interaction, result);
    return result;
  }

  // Check if user is individually authorized
  if (guildUser?.role === 'user') {
    const result: AuthResult = {
      authorized: true,
      reason: 'Authorized user',
      isSuperAdmin: false,
      isGuildAdmin: false,
      guildId,
    };
    setAuth(interaction, result);
    return result;
  }

  // Check if user has an authorized role
  if (interaction.member && 'roles' in interaction.member) {
    const memberRoles = (interaction.member as { roles: { cache: Map<string, unknown> } }).roles;
    const userRoleIds = new Set(memberRoles.cache.keys());
    const guildRoles = await roleRepo.findByGuild(guildId);
    const hasAuthorizedRole = guildRoles.some((r) => userRoleIds.has(r.role_id));

    if (hasAuthorizedRole) {
      const result: AuthResult = {
        authorized: true,
        reason: 'Authorized role',
        isSuperAdmin: false,
        isGuildAdmin: false,
        guildId,
      };
      setAuth(interaction, result);
      return result;
    }
  }

  // Not authorized
  const result: AuthResult = {
    authorized: false,
    reason: 'You are not authorized to use this bot in this server.',
    isSuperAdmin: false,
    isGuildAdmin: false,
    guildId,
  };
  setAuth(interaction, result);
  return result;
}
