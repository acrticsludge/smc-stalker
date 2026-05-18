/**
 * Discord client initialization and lifecycle management.
 */

import {
  Client,
  GatewayIntentBits,
} from 'discord.js';
import type { Sql } from 'postgres';
import { createLogger } from './lib/logger.js';
import { deployCommands } from './commands/register.js';
import { handleInteraction } from './events/interaction-create.js';
import { handleReady } from './events/ready.js';
import { createGuildRepository } from './repositories/guild.repository.js';

const logger = createLogger('bot');

export interface BotConfig {
  token: string;
  clientId: string;
}

let client: Client | null = null;

/**
 * Initialize and start the Discord client.
 *
 * Returns the client instance once it's ready.
 */
export async function startBot(config: BotConfig, sql: Sql): Promise<Client> {
  if (client) {
    return client;
  }

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
    ],
  });

  // Register event handlers
  client.on('clientReady', (readyClient) => {
    void handleReady(readyClient, sql);
  });

  client.on('interactionCreate', (interaction) => {
    void handleInteraction(interaction, sql);
  });

  // Login
  logger.info('Connecting to Discord...');
  await client.login(config.token);

  return client;
}

/**
 * Deploy slash commands to all whitelisted guilds.
 */
export async function deployToWhitelistedGuilds(
  token: string,
  clientId: string,
  sql: Sql,
): Promise<void> {
  const guildRepo = createGuildRepository(sql);
  const guilds = await guildRepo.findWhitelisted();

  for (const guild of guilds) {
    try {
      await deployCommands(token, clientId, guild.id);
      logger.info({ guildId: guild.id }, 'Commands deployed to guild');
    } catch (error) {
      logger.error(
        { guildId: guild.id, error: String(error) },
        'Failed to deploy commands to guild',
      );
    }
  }
}

/**
 * Gracefully shut down the Discord client.
 */
export async function stopBot(): Promise<void> {
  if (!client) return;

  logger.info('Shutting down Discord client...');
  await client.destroy();
  client = null;
}
