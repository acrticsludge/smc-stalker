/**
 * Alert service — evaluates alert conditions and produces alert payloads.
 */

import type { Sql } from 'postgres';
import { createAlertConfigRepository } from '../repositories/alert-config.repository.js';
import { createTownRepository } from '../repositories/town.repository.js';
import { createTownSnapshotRepository } from '../repositories/town-snapshot.repository.js';
import { createGuildConfigRepository } from '../repositories/guild-config.repository.js';
import type {
  UpkeepAlertPayload,
  EnemyAlertPayload,
  AlertPayload,
} from '../types/alerts.js';

export function createAlertService(sql: Sql) {
  const alertRepo = createAlertConfigRepository(sql);
  const townRepo = createTownRepository(sql);
  const snapshotRepo = createTownSnapshotRepository(sql);
  const configRepo = createGuildConfigRepository(sql);

  /**
   * Evaluate all enabled upkeep/friendly alerts and return payloads
   * for any that should fire.
   */
  async function evaluateUpkeepAlerts(): Promise<UpkeepAlertPayload[]> {
    const payloads: UpkeepAlertPayload[] = [];

    // Get all enabled upkeep and friendly alert configs
    const upkeepConfigs = await alertRepo.findEnabledByType('upkeep');
    const friendlyConfigs = await alertRepo.findEnabledByType('friendly');
    const allConfigs = [...upkeepConfigs, ...friendlyConfigs];

    for (const config of allConfigs) {
      // Check cooldown
      if (config.last_alert_at) {
        const cooldownMs = config.cooldown_min * 60 * 1000;
        const lastAlert = new Date(config.last_alert_at).getTime();
        if (Date.now() - lastAlert < cooldownMs) {
          continue;
        }
      }

      // Check schedule times (if configured)
      if (config.schedule_times.length > 0) {
        const now = new Date();
        const isScheduledTime = config.schedule_times.some((time) => {
          const [h, m] = time.split(':');
          const scheduledMinutes = Number.parseInt(h ?? '0', 10) * 60 + Number.parseInt(m ?? '0', 10);
          const currentMinutes = now.getHours() * 60 + now.getMinutes();
          // Allow a 5-minute window around the scheduled time
          return Math.abs(currentMinutes - scheduledMinutes) <= 5;
        });

        if (!isScheduledTime) {
          continue;
        }
      }

      // Find towns below threshold
      let atRiskTowns;
      if (config.nation_name) {
        // Filter by specific nation
        atRiskTowns = await townRepo.findByNationName(config.nation_name);
      } else if (config.type === 'friendly') {
        // Friendly: get friendly nations and find their towns
        const friendlyNations = await configRepo.getTyped<string[]>(
          config.guild_id,
          'friendly_nations',
        );
        if (!friendlyNations || friendlyNations.length === 0) continue;

        atRiskTowns = [];
        for (const nationName of friendlyNations) {
          const nationTowns = await townRepo.findByNationName(nationName);
          atRiskTowns.push(...nationTowns);
        }
      } else {
        // Upkeep: all towns
        atRiskTowns = await townRepo.findAll();
      }

      // Filter by threshold
      const thresholdTowns = atRiskTowns
        .filter((t) => t.bank > 0 && t.upkeep > 0)
        .filter((t) => t.bank < t.upkeep * config.threshold_days)
        .map((t) => ({
          townName: t.name,
          nationName: null, // Will be populated below
          bank: t.bank,
          upkeep: t.upkeep,
          daysRemaining: t.upkeep > 0 ? Math.floor(t.bank / t.upkeep) : 999,
        }));

      if (thresholdTowns.length === 0) {
        continue;
      }

      // Update last alert timestamp
      await alertRepo.update(config.id, {
        lastAlertAt: new Date().toISOString(),
      });

      payloads.push({
        guildId: config.guild_id,
        channelId: config.channel_id,
        roleId: config.role_id,
        nationPings: config.nation_pings,
        configId: config.id,
        nationName: config.nation_name,
        alertType: config.type as 'upkeep' | 'friendly',
        towns: thresholdTowns,
      });
    }

    return payloads;
  }

  /**
   * Evaluate enemy alerts — detect changes in enemy nation towns.
   */
  async function evaluateEnemyAlerts(): Promise<EnemyAlertPayload[]> {
    const payloads: EnemyAlertPayload[] = [];
    const enemyConfigs = await alertRepo.findEnabledByType('enemy');

    for (const config of enemyConfigs) {
      // Check cooldown
      if (config.last_alert_at) {
        const cooldownMs = config.cooldown_min * 60 * 1000;
        const lastAlert = new Date(config.last_alert_at).getTime();
        if (Date.now() - lastAlert < cooldownMs) {
          continue;
        }
      }

      // Get enemy nation names for this guild
      let enemyNations: string[];
      if (config.nation_name) {
        enemyNations = [config.nation_name];
      } else {
        const stored = await configRepo.getTyped<string[]>(
          config.guild_id,
          'enemy_nations',
        );
        enemyNations = stored ?? [];
      }

      if (enemyNations.length === 0) continue;

      let hasChanges = false;
      const changes: EnemyAlertPayload['changes'] = [];

      for (const nationName of enemyNations) {
        const towns = await townRepo.findByNationName(nationName);

        for (const town of towns) {
          const latestSnapshot = await snapshotRepo.findLatestByTown(town.id);

          if (!latestSnapshot) continue;

          // Check bank drop > 20%
          if (latestSnapshot.bank > 0 && town.bank < latestSnapshot.bank * 0.8) {
            changes.push({
              townName: town.name,
              type: 'bank_drop',
              oldValue: latestSnapshot.bank.toFixed(2),
              newValue: town.bank.toFixed(2),
            });
            hasChanges = true;
          }

          // Check mayor change
          if (latestSnapshot.mayor !== town.mayor) {
            changes.push({
              townName: town.name,
              type: 'mayor_change',
              oldValue: latestSnapshot.mayor,
              newValue: town.mayor,
            });
            hasChanges = true;
          }

          // Check resident change
          if (latestSnapshot.residents !== town.residents) {
            changes.push({
              townName: town.name,
              type: 'residents_change',
              oldValue: String(latestSnapshot.residents),
              newValue: String(town.residents),
            });
            hasChanges = true;
          }
        }

        // Check for new towns (towns in the current data that don't have snapshots)
        // This is detected by checking if the latest snapshot is very recent
        for (const town of towns) {
          const snapshot = await snapshotRepo.findLatestByTown(town.id);
          if (!snapshot) {
            changes.push({
              townName: town.name,
              type: 'new_town',
              oldValue: null,
              newValue: 'Town appeared in enemy nation',
            });
            hasChanges = true;
          }
        }
      }

      if (!hasChanges) continue;

      // Update last alert timestamp
      await alertRepo.update(config.id, {
        lastAlertAt: new Date().toISOString(),
      });

      payloads.push({
        guildId: config.guild_id,
        channelId: config.channel_id,
        roleId: config.role_id,
        configId: config.id,
        nationName: config.nation_name ?? enemyNations.join(', '),
        alertType: 'enemy',
        changes,
      });
    }

    return payloads;
  }

  /**
   * Evaluate all alert types and return payloads.
   */
  async function evaluateAll(): Promise<AlertPayload[]> {
    const upkeep = await evaluateUpkeepAlerts();
    const enemy = await evaluateEnemyAlerts();

    return [...upkeep, ...enemy] as AlertPayload[];
  }

  return { evaluateUpkeepAlerts, evaluateEnemyAlerts, evaluateAll };
}
