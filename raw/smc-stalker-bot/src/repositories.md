# Module: smc-stalker-bot/src/repositories

**Purpose:** Database access layer — 13 repository functions providing CRUD and query operations for all Postgres tables, wrapping the `postgres` SQL template literal library.

**Source:** smc-stalker-bot/src/repositories/

## Key Files
| Path | Purpose | Key Exports |
|------|---------|-------------|
| town.repository.ts | Town CRUD, find by nation, bank threshold queries, stale cleanup | createTownRepository |
| nation.repository.ts | Nation CRUD, find all, lookup by name | createNationRepository |
| alert-config.repository.ts | Alert config CRUD, find by guild/type/enabled, dynamic update | createAlertConfigRepository, AlertType |
| guild.repository.ts | Guild CRUD, whitelist management | createGuildRepository |
| guild-user.repository.ts | Guild user management (admin/user roles) | createGuildUserRepository |
| guild-role.repository.ts | Guild role-id mapping | createGuildRoleRepository |
| guild-config.repository.ts | Guild key-value config storage | createGuildConfigRepository |
| town-snapshot.repository.ts | Town snapshot CRUD for historical tracking | createTownSnapshotRepository |
| territory-shape.repository.ts | Dynmap territory shape storage | createTerritoryShapeRepository |
| poll-run.repository.ts | Poll execution history and metrics | createPollRunRepository |
| access-request.repository.ts | Guild access request management | createAccessRequestRepository |
| town-resident-series.repository.ts | Time-series resident data for towns | createTownResidentSeriesRepository |
| nation-resident-series.repository.ts | Time-series resident data for nations | createNationResidentSeriesRepository |

## Data Flow
Each repository is a factory function receiving a `postgres` Sql instance. SQL queries use tagged template literals for parameterization (injection-safe). All write operations use upsert (`ON CONFLICT ... DO UPDATE`) for idempotent data ingestion from Dynmap polls. Query results are typed via `sql<RowType[]>`. The `alert-config.repository.ts` has a dynamic update method that converts camelCase keys to snake_case columns at runtime.

## Key Types & Interfaces
- **AlertType**: Type union of "upkeep" | "friendly" | "enemy" — drives alert filtering.
- **Repository return types**: All methods return typed Promise resolving to Row types from `../types/database.js`.

## Error Handling Patterns
No custom error handling — SQL errors bubble up to callers. The `postgres` library throws on connection/query failures. The dynamic update in `alert-config.repository.ts` uses `sql.unsafe` for the generated query which bypasses template safety — if the column name derivation breaks, the query fails at the database level.

## Edge Cases & Gotchas
- `alert-config.repository.ts` uses `sql.unsafe` for dynamic updates — column names are derived from JS object keys via `toSnakeCase`. An unexpected key would produce an invalid column name and fail at query time.
- The `update` method filters out `undefined` values but not `null` — passing `{ roleId: null }` explicitly sets the column to NULL.
- `town.repository.ts` uses `COALESCE` on `founded` and `color` — once a town has a founded date, subsequent polls won't overwrite it with null.
- `markStale` deletes towns not seen since a given date — this is a hard delete, not a soft delete.
- `findByBankThreshold` uses `NULLIF(upkeep, 0)` to avoid division by zero — towns with zero upkeep are excluded from bank threshold calculations.
