/**
 * Bot ready event handler.
 *
 * 1. Upserts all guilds the bot is in into the database (so FK constraints work)
 * 2. Deploys slash commands to every guild
 * Auth is enforced separately — non-whitelisted guilds see commands but
 * get blocked by the auth service until whitelisted.
 */

import type { Client } from 'discord.js';
import type { Sql } from 'postgres';
import { createLogger } from '../lib/logger.js';
import { deployCommands } from '../commands/register.js';
import { createGuildRepository } from '../repositories/guild.repository.js';
import { BOT_NAME, BOT_VERSION } from '../config/constants.js';

const logger = createLogger('ready');

/**
 * Handle the 'ready' event.
 */
export async function handleReady(client: Client<true>, sql: Sql): Promise<void> {
  logger.info(
    {
      user: client.user.tag,
      guilds: client.guilds.cache.size,
      version: BOT_VERSION,
    },
    `${BOT_NAME} v${BOT_VERSION} connected to Discord`,
  );

  const token = client.token;
  if (!token) {
    logger.error('No client token available for command deployment');
    return;
  }

  // Upsert all guilds into the DB so foreign key constraints don't fail
  // when creating alert configs or other guild-scoped records.
  const guildRepo = createGuildRepository(sql);
  for (const [guildId, guild] of client.guilds.cache) {
    try {
      await guildRepo.upsert(guildId, guild.name);
    } catch (error) {
      logger.error({ guildId, error: String(error) }, 'Failed to upsert guild');
    }
  }

  // Deploy commands to every guild the bot is in.
  const guildIds = client.guilds.cache.keys();
  let deployed = 0;
  let failed = 0;

  for (const guildId of guildIds) {
    try {
      await deployCommands(token, client.user.id, guildId);
      deployed++;
    } catch (error) {
      failed++;
      logger.error(
        { guildId, error: String(error) },
        'Failed to deploy commands to guild',
      );
    }
  }

  logger.info({ deployed, failed }, 'Command deployment complete');
}
