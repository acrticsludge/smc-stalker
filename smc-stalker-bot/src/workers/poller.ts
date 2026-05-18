/**
 * Poller worker — runs the dynmap poll loop on a configurable interval.
 *
 * Stateless design: all state lives in the database.
 * The poller can restart without data loss.
 */

import type { Sql } from 'postgres';
import type { Client } from 'discord.js';
import { createLogger } from '../lib/logger.js';
import { createPollService } from '../services/poll.service.js';
import { createAlertService } from '../services/alert.service.js';
import { POLL_INTERVAL_MS } from '../config/constants.js';
import type { AlertPayload, UpkeepAlertPayload, EnemyAlertPayload, UpkeepAlertTown } from '../types/alerts.js';
import { warningEmbed, dangerEmbed } from '../lib/embed-builder.js';

const logger = createLogger('poller');

export interface PollerConfig {
  dynmapUrl: string;
  dynmapTimeoutMs: number;
  intervalMs?: number;
}

/**
 * Start the polling loop.
 */
export function startPoller(
  config: PollerConfig,
  sql: Sql,
  discordClient: Client,
): { stop: () => void } {
  const pollService = createPollService(
    { dynmapUrl: config.dynmapUrl, dynmapTimeoutMs: config.dynmapTimeoutMs },
    sql,
  );
  const alertService = createAlertService(sql);

  let activeTimer: ReturnType<typeof setInterval> | null = null;
  let isRunning = false;

  async function tick(): Promise<void> {
    if (isRunning) {
      logger.warn('Previous poll cycle still running — skipping this tick');
      return;
    }

    isRunning = true;
    const startTime = Date.now();

    try {
      const pollResult = await pollService.executePoll();

      if (!pollResult.success) {
        logger.error(
          { error: pollResult.error, durationMs: Date.now() - startTime },
          'Poll cycle failed, skipping alert evaluation',
        );
        return;
      }

      logger.info(
        {
          townsFound: pollResult.towns.length,
          durationMs: Date.now() - startTime,
        },
        'Poll completed, evaluating alerts...',
      );

      const alertPayloads = await alertService.evaluateAll();

      for (const payload of alertPayloads) {
        try {
          await dispatchAlert(payload, discordClient);
        } catch (error) {
          logger.error(
            { alertType: payload.alertType, guildId: payload.guildId, error: String(error) },
            'Failed to dispatch alert',
          );
        }
      }

      if (alertPayloads.length > 0) {
        logger.info({ alertsDispatched: alertPayloads.length }, 'Alerts dispatched');
      }
    } catch (error) {
      logger.error({ error: String(error) }, 'Unhandled poller error');
    } finally {
      isRunning = false;
    }
  }

  logger.info({ intervalMs: config.intervalMs ?? POLL_INTERVAL_MS }, 'Starting poller');
  void tick();
  activeTimer = setInterval(() => { void tick(); }, config.intervalMs ?? POLL_INTERVAL_MS);

  return {
    stop(): void {
      if (activeTimer) {
        clearInterval(activeTimer);
        activeTimer = null;
        logger.info('Poller stopped');
      }
    },
  };
}

async function dispatchAlert(payload: AlertPayload, client: Client): Promise<void> {
  switch (payload.alertType) {
    case 'upkeep':
    case 'friendly':
      await dispatchUpkeepAlert(payload, client);
      break;
    case 'enemy':
      await dispatchEnemyAlert(payload, client);
      break;
  }
}

/**
 * Dispatch an upkeep/friendly alert with per-nation role pings.
 *
 * Towns are grouped by nation. Each group is sent as a separate message
 * with the configured role ping for that nation (if any).
 */
async function dispatchUpkeepAlert(
  payload: UpkeepAlertPayload,
  client: Client,
): Promise<void> {
  const channelResolved = await client.channels.fetch(payload.channelId);
  if (!channelResolved?.isTextBased() || channelResolved.isDMBased()) {
    logger.warn({ channelId: payload.channelId }, 'Alert channel not found, not text-based, or is DM');
    return;
  }

  const channel = channelResolved;

  // Group towns by nation name
  const grouped = new Map<string | null, UpkeepAlertTown[]>();
  for (const town of payload.towns) {
    const key = town.nationName ?? 'None';
    const list = grouped.get(key) ?? [];
    list.push(town);
    grouped.set(key, list);
  }

  const title =
    payload.alertType === 'friendly'
      ? `⚠️ Friendly Nation Alert`
      : `⚠️ Upkeep Alert`;

  for (const [nation, towns] of grouped) {
    // Look up nation-specific ping; fall back to default roleId
    const specificPing = nation ? (payload.nationPings[nation] ?? null) : null;
    const roleId = specificPing ?? payload.roleId;
    const roleMention = roleId ? `<@&${roleId}> ` : '';

    const description = towns
      .map(
        (t) =>
          `• **${t.townName}** — Bank: $${t.bank.toFixed(2)} | Upkeep: $${t.upkeep.toFixed(2)}/day | **${t.daysRemaining} days** remaining`,
      )
      .join('\n');

    const fullDescription = nation && nation !== 'None'
      ? `Nation: **${nation}**\n\n${description}`
      : description;

    const embed = warningEmbed(title, fullDescription);

    await channel.send({
      content: roleMention || undefined,
      embeds: [embed],
    });
  }
}

/**
 * Dispatch an enemy activity alert.
 */
async function dispatchEnemyAlert(
  payload: EnemyAlertPayload,
  client: Client,
): Promise<void> {
  const channelResolved = await client.channels.fetch(payload.channelId);
  if (!channelResolved?.isTextBased() || channelResolved.isDMBased()) {
    logger.warn({ channelId: payload.channelId }, 'Alert channel not found, not text-based, or is DM');
    return;
  }

  const channel = channelResolved;
  const roleMention = payload.roleId ? `<@&${payload.roleId}> ` : '';

  const changes = payload.changes
    .map((c) => {
      const oldVal = c.oldValue ? ` (was: ${c.oldValue})` : '';
      return `• **${c.townName}** — ${c.type.replace(/_/g, ' ')}${oldVal} → ${c.newValue}`;
    })
    .join('\n');

  const embed = dangerEmbed(
    `🚨 Enemy Activity: ${payload.nationName}`,
    changes,
  );

  await channel.send({
    content: roleMention || undefined,
    embeds: [embed],
  });
}
