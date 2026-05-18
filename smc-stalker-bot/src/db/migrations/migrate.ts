/**
 * Simple migration runner.
 *
 * Reads SQL files from the migrations directory (same folder),
 * tracks which have been applied via a `_migrations` table,
 * and applies any new migrations in order.
 *
 * Usage: npx tsx src/db/migrations/migrate.ts
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface MigrationRecord {
  filename: string;
  applied_at: string;
}

async function migrate(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  const sql = postgres(databaseUrl, { max: 1 });

  try {
    // Ensure migrations tracking table exists
    await sql`
      CREATE TABLE IF NOT EXISTS _migrations (
        filename    TEXT PRIMARY KEY,
        applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    // Get already-applied migrations
    const applied = await sql<
      MigrationRecord[]
    >`SELECT filename FROM _migrations ORDER BY filename`;
    const appliedSet = new Set(applied.map((r) => r.filename));

    // Read migration files, sorted by name
    const migrationsDir = __dirname;
    const files = readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    let count = 0;

    for (const file of files) {
      if (appliedSet.has(file)) {
        continue;
      }

      const filePath = join(migrationsDir, file);
      const content = readFileSync(filePath, 'utf-8');

      // eslint-disable-next-line no-console
      console.log(`Applying migration: ${file}...`);

      // Run the migration inside a transaction
      await sql.begin(async (tx) => {
        await tx.unsafe(content);
        await tx`INSERT INTO _migrations (filename) VALUES (${file})`;
      });

      // eslint-disable-next-line no-console
      console.log(`  ✓ ${file} applied`);
      count++;
    }

    if (count === 0) {
      // eslint-disable-next-line no-console
      console.log('No pending migrations.');
    } else {
      // eslint-disable-next-line no-console
      console.log(`Applied ${count} migration(s).`);
    }
  } finally {
    await sql.end();
  }
}

migrate().catch((err: unknown) => {
  // eslint-disable-next-line no-console
  console.error('Migration failed:', err);
  process.exit(1);
});
