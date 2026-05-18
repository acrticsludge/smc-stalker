/**
 * Command registration entry point.
 */

import type { Sql } from 'postgres';

import { registerWhitelistCommands } from './admin/whitelist.js';
import { registerAdminCommands } from './admin/manage-admin.js';
import { registerInspectCommand } from './admin/inspect.js';
import { registerToggleAuthCommand } from './admin/toggle-auth.js';
import { registerPendingRequestsCommand } from './admin/pending-requests.js';
import { registerUpkeepTownCommand } from './upkeep/town.js';
import { registerUpkeepNationCommand } from './upkeep/nation.js';
import { registerListCommands } from './upkeep/list.js';
import { registerAtRiskCommand } from './upkeep/at-risk.js';
import { registerAlertConfigureCommand } from './alerts/configure.js';
import { registerAlertStatusCommand } from './alerts/status.js';
import { registerAlertsViewCommand } from './alerts/view.js';
import { registerHelpCommand } from './help.js';
import { registerAccessCommand } from './access.js';

export function registerAllCommands(sql: Sql): void {
  registerHelpCommand(sql);
  registerAccessCommand(sql);

  registerWhitelistCommands(sql);
  registerAdminCommands(sql);
  registerInspectCommand(sql);
  registerToggleAuthCommand(sql);
  registerPendingRequestsCommand(sql);

  registerUpkeepTownCommand(sql);
  registerUpkeepNationCommand(sql);
  registerListCommands(sql);
  registerAtRiskCommand(sql);

  registerAlertConfigureCommand(sql);
  registerAlertStatusCommand(sql);
  registerAlertsViewCommand(sql);
}
