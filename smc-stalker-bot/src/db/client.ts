import postgres, { type Sql } from 'postgres';

let sql: Sql | null = null;

/**
 * PostgreSQL OID for NUMERIC/DECIMAL type.
 */
const NUMERIC_OID = 1700;

/**
 * Initialize the database connection pool.
 * Must be called once at startup with the DATABASE_URL.
 *
 * BIGINT values (Discord snowflakes) are returned as `string`
 * by default to avoid JavaScript Number precision loss.
 * NUMERIC is cast to Number since our decimal columns (DECIMAL(12,2))
 * fit safely within Number.MAX_SAFE_INTEGER.
 */
export function createDbClient(url: string): Sql {
  if (sql) {
    return sql;
  }

  sql = postgres(url, {
    max: 5,
    idle_timeout: 30,
    connect_timeout: 15,
    types: {
      numeric: {
        to: NUMERIC_OID,
        from: [NUMERIC_OID],
        serialize: (value: number): string => value.toString(),
        parse: (raw: string): number => Number(raw),
      },
    },
  });

  return sql;
}

/**
 * Get the database client. Throws if not initialized.
 */
export function getDb(): Sql {
  if (!sql) {
    throw new Error('Database client not initialized. Call createDbClient first.');
  }
  return sql;
}

/**
 * Close all database connections. Call on graceful shutdown.
 */
export async function closeDb(): Promise<void> {
  if (sql) {
    await sql.end({ timeout: 5 });
    sql = null;
  }
}
