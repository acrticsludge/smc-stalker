/**
 * SMC Stalker Bot — Entry Point
 *
 * Initializes, in order:
 *  1. Environment variable validation
 *  2. Structured logging
 *  3. Database connection
 *  4. Command registration
 *  5. Discord client connection
 *  6. Poller worker
 *  7. Graceful shutdown handlers
 */

import { loadEnv } from './config/env.js';
import { createRootLogger, createLogger } from './lib/logger.js';
import { BOT_NAME, BOT_VERSION } from './config/constants.js';
import { createDbClient, closeDb } from './db/client.js';
import { startBot, stopBot } from './bot.js';
import { registerAllCommands } from './commands/index.js';
import { startPoller } from './workers/poller.js';
import { recordBotStart } from './services/health.service.js';

function main(): void {
  // 1. Validate environment
  const env = loadEnv();

  // 2. Initialize logging
  createRootLogger(env);
  const logger = createLogger('main');

  logger.info(
    {
      version: BOT_VERSION,
      nodeEnv: env.NODE_ENV,
      logLevel: env.LOG_LEVEL,
    },
    `${BOT_NAME} v${BOT_VERSION} starting...`,
  );

  // 3. Initialize database
  const sql = createDbClient(env.DATABASE_URL);
  logger.info('Database connected');

  // 4. Register all slash commands
  registerAllCommands(sql);
  logger.info('Commands registered');

  // 5. Record bot start time
  recordBotStart();

  // 6. Start Discord client (this also deploys commands on ready)
  startBot({ token: env.DISCORD_TOKEN, clientId: env.DISCORD_CLIENT_ID }, sql)
    .then((client) => {
      logger.info('Discord client connected');

      // 7. Start poller
      const poller = startPoller(
        {
          dynmapUrl: env.DYNMAP_URL,
          dynmapTimeoutMs: env.DYNMAP_TIMEOUT_MS,
        },
        sql,
        client,
      );

      logger.info(`${BOT_NAME} v${BOT_VERSION} fully initialized`);

      // 8. Graceful shutdown
      const shutdown = async (signal: string): Promise<void> => {
        logger.info({ signal }, 'Shutdown signal received');
        poller.stop();
        await stopBot();
        await closeDb();
        logger.info('Shutdown complete');
        process.exit(0);
      };

      process.on('SIGINT', () => { void shutdown('SIGINT'); });
      process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
      process.on('SIGHUP', () => { void shutdown('SIGHUP'); });
    })
    .catch((error: unknown) => {
      logger.error({ error: String(error) }, 'Failed to start bot');
      process.exit(1);
    });
}

main();
