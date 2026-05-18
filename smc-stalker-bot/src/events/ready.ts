/**
 * Bot ready event handler.
 *
 * Deploys slash commands to every guild the bot is connected to.
 * Auth is enforced separately — non-whitelisted guilds will see
 * commands but get blocked by the auth service until whitelisted.
 */

import type { Client } from 'discord.js';
import type { Sql } from 'postgres';
import { createLogger } from '../lib/logger.js';
import { deployCommands } from '../commands/register.js';
import { BOT_NAME, BOT_VERSION } from '../config/constants.js';

const logger = createLogger('ready');

/**
 * Handle the 'ready' event.
 */
export async function handleReady(client: Client<true>, _sql: Sql): Promise<void> {
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

  // Deploy commands to every guild the bot is in (not just whitelisted ones).
  // This ensures commands are visible immediately. The auth layer blocks
  // non-whitelisted guilds from actually using them.
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
