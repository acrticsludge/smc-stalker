import pino from 'pino';
import { type Env } from '../config/env.js';

let rootLogger: pino.Logger | null = null;

/**
 * Create or return the root pino logger.
 *
 * Call once with env config; subsequent calls return the cached instance.
 */
export function createRootLogger(env: Env): pino.Logger {
  if (rootLogger) {
    return rootLogger;
  }

  rootLogger = pino({
    level: env.LOG_LEVEL,
    name: 'smc-stalker-bot',
    transport:
      env.NODE_ENV === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss.l',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
  });

  return rootLogger;
}

/**
 * Get the root logger. Throws if not initialized.
 */
export function getLogger(): pino.Logger {
  if (!rootLogger) {
    throw new Error('Logger not initialized. Call createRootLogger first.');
  }
  return rootLogger;
}

/**
 * Create a child logger for a named module.
 */
export function createLogger(name: string): pino.Logger {
  return getLogger().child({ module: name });
}
