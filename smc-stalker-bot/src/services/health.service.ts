/**
 * Health/diagnostics service.
 *
 * Provides status information about the bot, poller, and data freshness.
 */

import type { Sql } from 'postgres';
import { createPollRunRepository } from '../repositories/poll-run.repository.js';
import { createTownRepository } from '../repositories/town.repository.js';
import { createNationRepository } from '../repositories/nation.repository.js';
import { BOT_NAME, BOT_VERSION, STALE_POLL_THRESHOLD } from '../config/constants.js';

let botStartTime = Date.now();

export function recordBotStart(): void {
  botStartTime = Date.now();
}

export function getUptimeMs(): number {
  return Date.now() - botStartTime;
}

export interface BotHealth {
  botName: string;
  version: string;
  uptimeSeconds: number;
  lastPoll: PollStatus | null;
  recentPolls: PollSummary[];
  towns: number;
  nations: number;
  isHealthy: boolean;
}

export interface PollStatus {
  success: boolean;
  startedAt: string;
  durationMs: number;
  townsFound: number;
  isStale: boolean;
}

export interface PollSummary {
  id: string;
  success: boolean;
  startedAt: string;
  durationMs: number;
  townsFound: number;
}

export function createHealthService(sql: Sql) {
  const pollRunRepo = createPollRunRepository(sql);
  const townRepo = createTownRepository(sql);
  const nationRepo = createNationRepository(sql);

  async function getHealth(): Promise<BotHealth> {
    const [latestPoll, recentPolls, towns, nations] = await Promise.all([
      pollRunRepo.findLatestSuccessful(),
      pollRunRepo.findLatest(10),
      townRepo.findAll(),
      nationRepo.findAll(),
    ]);

    // Determine stale status (3+ consecutive failed polls or no successful poll)
    let isStale = false;
    let pollStatus: PollStatus | null = null;

    const recentFailedCount = recentPolls
      .slice(0, STALE_POLL_THRESHOLD)
      .filter((p) => !p.success).length;

    isStale = recentFailedCount >= STALE_POLL_THRESHOLD || recentPolls.length === 0;

    if (latestPoll) {
      pollStatus = {
        success: latestPoll.success,
        startedAt: latestPoll.started_at,
        durationMs: latestPoll.duration_ms,
        townsFound: latestPoll.towns_found,
        isStale,
      };
    }

    return {
      botName: BOT_NAME,
      version: BOT_VERSION,
      uptimeSeconds: Math.floor(getUptimeMs() / 1000),
      lastPoll: pollStatus,
      recentPolls: recentPolls.map((p) => ({
        id: p.id,
        success: p.success,
        startedAt: p.started_at,
        durationMs: p.duration_ms,
        townsFound: p.towns_found,
      })),
      towns: towns.length,
      nations: nations.length,
      isHealthy: !isStale,
    };
  }

  return { getHealth };
}
