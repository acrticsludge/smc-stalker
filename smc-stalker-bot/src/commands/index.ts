/**
 * Command registration entry point.
 *
 * Imports and registers all bot commands.
 * Call once at startup with the database client.
 */

import type { Sql } from 'postgres';

import { registerWhitelistCommands } from './admin/whitelist.js';
import { registerAdminCommands } from './admin/manage-admin.js';
import { registerInspectCommand } from './admin/inspect.js';
import { registerToggleAuthCommand } from './admin/toggle-auth.js';
import { registerUpkeepTownCommand } from './upkeep/town.js';
import { registerUpkeepNationCommand } from './upkeep/nation.js';
import { registerListCommands } from './upkeep/list.js';
import { registerAtRiskCommand } from './upkeep/at-risk.js';
import { registerAlertConfigureCommand } from './alerts/configure.js';
import { registerAlertStatusCommand } from './alerts/status.js';
import { registerAlertsViewCommand } from './alerts/view.js';
import { registerHelpCommand } from './help.js';

/**
 * Register all bot commands with the command registry.
 */
export function registerAllCommands(sql: Sql): void {
  // Help
  registerHelpCommand(sql);

  // Admin commands (superadmin only)
  registerWhitelistCommands(sql);
  registerAdminCommands(sql);
  registerInspectCommand(sql);
  registerToggleAuthCommand(sql);

  // Upkeep commands
  registerUpkeepTownCommand(sql);
  registerUpkeepNationCommand(sql);
  registerListCommands(sql);
  registerAtRiskCommand(sql);

  // Alert commands
  registerAlertConfigureCommand(sql);
  registerAlertStatusCommand(sql);
  registerAlertsViewCommand(sql);
}
