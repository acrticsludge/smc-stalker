/**
 * Alert-related types used across the alert evaluation and dispatch pipeline.
 */

/** The categories of alerts the bot supports */
export type AlertCategory = 'upkeep' | 'friendly' | 'enemy';

/** A town that is below its upkeep threshold */
export interface UpkeepAlertTown {
  townName: string;
  nationName: string | null;
  bank: number;
  upkeep: number;
  daysRemaining: number;
}

/** A change detected in an enemy nation's town */
export interface EnemyChange {
  townName: string;
  type: 'new_town' | 'territory_change' | 'bank_drop' | 'residents_change' | 'mayor_change';
  oldValue: string | null;
  newValue: string;
}

/** Payload for dispatching an upkeep alert */
export interface UpkeepAlertPayload {
  guildId: string;
  channelId: string;
  roleId: string | null;
  nationPings: Record<string, string | null>;
  configId: string;
  nationName: string | null;
  alertType: 'upkeep' | 'friendly';
  towns: UpkeepAlertTown[];
}

/** Payload for dispatching an enemy activity alert */
export interface EnemyAlertPayload {
  guildId: string;
  channelId: string;
  roleId: string | null;
  configId: string;
  nationName: string;
  alertType: 'enemy';
  changes: EnemyChange[];
}

/** Union of all alert payloads */
export type AlertPayload = UpkeepAlertPayload | EnemyAlertPayload;
