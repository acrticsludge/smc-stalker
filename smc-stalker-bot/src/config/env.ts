import { config } from 'dotenv';
import { z } from 'zod';

// Load .env.local from one level above (the monorepo root)
config({ path: '../.env.local' });

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required'),

  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),

  DYNMAP_URL: z.string().url('DYNMAP_URL must be a valid URL'),
  DYNMAP_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),

  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validated environment variables.
 *
 * Call this once at startup. Throws if required vars are missing or invalid.
 */
export function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    // eslint-disable-next-line no-console
    console.error('Invalid environment variables:\n' + issues);
    process.exit(1);
  }
  return result.data;
}
