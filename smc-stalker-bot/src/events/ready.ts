/**
 * Bot ready event handler.
 */

import type { Client } from 'discord.js';
import type { Sql } from 'postgres';
import { createLogger } from '../lib/logger.js';
import { deployToWhitelistedGuilds } from '../bot.js';
import { BOT_NAME, BOT_VERSION } from '../config/constants.js';

const logger = createLogger('ready');

/**
 * Handle the 'ready' event.
 * Logs startup info and deploys commands to whitelisted guilds.
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

  // Deploy slash commands to all whitelisted guilds
  const token = client.token;
  if (!token) {
    logger.error('No client token available for command deployment');
    return;
  }

  try {
    await deployToWhitelistedGuilds(token, client.user.id, sql);
    logger.info('Command deployment complete');
  } catch (error) {
    logger.error({ error: String(error) }, 'Command deployment failed');
  }
}
