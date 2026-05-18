import { loadEnv } from './config/env.js';
import { createRootLogger, createLogger } from './lib/logger.js';
import { BOT_NAME, BOT_VERSION } from './config/constants.js';

function main(): void {
  // 1. Validate environment variables
  const env = loadEnv();

  // 2. Initialize structured logging
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

  // TODO: Phase 2+ — Initialize database connection
  // TODO: Phase 5 — Initialize Discord client
  // TODO: Phase 8 — Start poller worker

  logger.info(`${BOT_NAME} initialized successfully`);
}

main();
