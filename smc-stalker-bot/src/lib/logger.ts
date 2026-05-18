import pino from 'pino';
import { type Env } from '../config/env.js';

let rootLogger: pino.Logger | null = null;

/**
 * Create or return the root pino logger.
 *
 * Call once at startup with env config to properly configure level and transport.
 * Safe to call multiple times — second call reconfigures the root logger.
 */
export function createRootLogger(env: Env): pino.Logger {
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
 * Get the root logger.
 *
 * If called before createRootLogger, auto-initializes with defaults
 * (info level, JSON output). This handles modules that call createLogger
 * at the top level before the boot sequence initializes the logger.
 */
export function getLogger(): pino.Logger {
  rootLogger ??= pino({
    level: 'info',
    name: 'smc-stalker-bot',
  });
  return rootLogger;
}

/**
 * Create a child logger for a named module.
 *
 * Safe to call before createRootLogger — the child will be re-parented
 * to the proper root logger once createRootLogger is called.
 */
export function createLogger(name: string): pino.Logger {
  return getLogger().child({ module: name });
}
