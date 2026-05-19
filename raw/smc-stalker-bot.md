# Module: smc-stalker-bot

**Purpose:** Discord bot project root configuration — ESLint strict TypeScript rules, Vitest test runner setup, and project metadata.

**Source:** smc-stalker-bot/

## Key Files
| Path | Purpose | Key Exports |
|------|---------|-------------|
| smc-stalker-bot/eslint.config.js | ESLint config with strict TypeScript rules, Prettier integration | `config` |
| smc-stalker-bot/vitest.config.ts | Vitest test runner config (node env, coverage, test patterns) | `config` |

## Data Flow
Static configuration files loaded at dev/build time. ESLint validates all `src/**/*.ts` (excluding dist/, node_modules/, coverage/). Vitest runs tests from `tests/**/*.test.ts`. Both configurations are consumed by their respective CLI tools.

## Key Types & Interfaces
- **typescript-eslint** config presets: `strictTypeChecked`, `stylisticTypeChecked` — full type-aware linting with strict mode.
- **Vitest defineConfig**: Standard vitest configuration interface.

## Error Handling Patterns
No runtime error handling. ESLint catches type errors, non-null assertions, floating promises, and unused variables at lint time. The ESLint ruleset is deliberately strict — `no-explicit-any` is error, `no-floating-promises` and `await-thenable` are errors. `no-console` is a warning.

## Edge Cases & Gotchas
- ESLint uses `projectService: true` for type-aware linting — requires `tsconfig.json` to be valid and include all linted files. Missing type info silently skips type-checked rules.
- `no-non-null-assertion` is OFF — the team allows `!` when the compiler lacks context. This is intentional for DB `INSERT...RETURNING` patterns.
- Prettier config is referenced externally (not in this file). If `.prettierrc` is missing, formatting falls back to defaults.
- Coverage includes `src/**/*.ts` only — tests are excluded.
