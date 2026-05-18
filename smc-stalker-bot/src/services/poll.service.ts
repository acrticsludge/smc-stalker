/**
 * Poll service — orchestrates fetching dynmap data and persisting it.
 *
 * Uses sequential non-transactional writes. If one town fails, the others
 * still get saved. Partial success tolerance.
 */

import type { Sql } from 'postgres';
import { createDynmapClient } from '../lib/dynmap-client.js';
import { createLogger } from '../lib/logger.js';
import { createNationRepository } from '../repositories/nation.repository.js';
import { createTownRepository } from '../repositories/town.repository.js';
import { createTownSnapshotRepository } from '../repositories/town-snapshot.repository.js';
import { createTerritoryShapeRepository } from '../repositories/territory-shape.repository.js';
import { createPollRunRepository } from '../repositories/poll-run.repository.js';
import { createTownResidentSeriesRepository } from '../repositories/town-resident-series.repository.js';
import { createNationResidentSeriesRepository } from '../repositories/nation-resident-series.repository.js';
import type { DynmapPollResult } from '../types/dynmap.js';

const logger = createLogger('poll-service');

export interface PollServiceConfig {
  dynmapUrl: string;
  dynmapTimeoutMs: number;
}

export function createPollService(config: PollServiceConfig, sql: Sql) {
  const dynmap = createDynmapClient({
    url: config.dynmapUrl,
    timeoutMs: config.dynmapTimeoutMs,
  });

  const nationRepo = createNationRepository(sql);
  const townRepo = createTownRepository(sql);
  const snapshotRepo = createTownSnapshotRepository(sql);
  const shapeRepo = createTerritoryShapeRepository(sql);
  const pollRunRepo = createPollRunRepository(sql);
  const townSeriesRepo = createTownResidentSeriesRepository(sql);
  const nationSeriesRepo = createNationResidentSeriesRepository(sql);

  // Track processed data for daily series upsert and color averaging
  interface ProcessedTown {
    townId: string;
    nationId: string | null;
    residents: number;
    fillColor: number | null;
  }
  const processedTowns: ProcessedTown[] = [];
  // Track fill colors per nation for averaging
  const nationColors = new Map<string, number[]>();

  /**
   * Execute a full poll cycle:
   *  1. Fetch dynmap data
   *  2. Upsert nations and towns
   *  3. Create snapshots (with resident names + status)
   *  4. Upsert territory shapes
   *  5. Upsert daily resident series
   *  6. Record poll run
   */
  async function executePoll(): Promise<DynmapPollResult> {
    const pollRun = await pollRunRepo.create();
    const startTime = Date.now();

    try {
      const result = await dynmap.fetchMarkers();

      if (!result.success) {
        await pollRunRepo.complete(pollRun.id, {
          success: false,
          errorMessage: result.error,
          townsFound: 0,
          townsUpdated: 0,
          durationMs: Date.now() - startTime,
        });
        return result;
      }

      let townsUpdated = 0;
      const errors: string[] = [];
      processedTowns.length = 0;

      // Process each town sequentially
      for (const town of result.towns) {
        try {
          // Upsert nation first
          let nationId: string | null = null;
          if (town.nation) {
            const nation = await nationRepo.upsert(town.nation, town.fillColor);
            nationId = nation.id;
            // Track color for averaging
            if (town.fillColor !== null) {
              const existing = nationColors.get(nation.id) ?? [];
              existing.push(town.fillColor);
              nationColors.set(nation.id, existing);
            }
          }

          // Upsert town with colour
          const savedTown = await townRepo.upsert({
            name: town.name,
            mayor: town.mayor,
            residents: town.residents,
            nationId,
            founded: town.founded,
            bank: town.bank,
            upkeep: town.upkeep,
            color: town.fillColor,
          });

          // Create historical snapshot with new fields
          await snapshotRepo.create({
            townId: savedTown.id,
            mayor: town.mayor,
            residents: town.residents,
            residentNames: town.residentNames,
            status: town.status,
            nationId,
            bank: town.bank,
            upkeep: town.upkeep,
          });

          processedTowns.push({
            townId: savedTown.id,
            nationId,
            residents: town.residents,
            fillColor: town.fillColor,
          });

          townsUpdated++;
        } catch (error) {
          const msg = `Failed to process town ${town.name}: ${String(error)}`;
          errors.push(msg);
          logger.warn({ town: town.name, error: String(error) }, 'Town processing failed');
        }
      }

      // Upsert territory shapes
      for (const shape of result.shapes) {
        try {
          const townRow = await townRepo.findByName(shape.townName);
          if (townRow) {
            await shapeRepo.upsert({
              townId: townRow.id,
              regionIndex: shape.regionIndex,
              markerKey: shape.markerKey,
              shape: shape.shape,
              holes: shape.holes,
              shapeY: shape.shapeY,
            });
          }
        } catch (error) {
          logger.warn(
            { shape: shape.markerKey, error: String(error) },
            'Shape upsert failed',
          );
        }
      }

      // Average nation colors from all towns' fill colors
      for (const [nationId, colors] of nationColors) {
        if (colors.length > 0) {
          const avg = Math.round(colors.reduce((a, b) => a + b, 0) / colors.length);
          await nationRepo.updateColor(nationId, avg);
        }
      }

      // Upsert daily resident series
      await upsertDailySeries();

      const durationMs = Date.now() - startTime;

      await pollRunRepo.complete(pollRun.id, {
        success: errors.length === 0,
        errorMessage: errors.length > 0 ? errors.join('; ') : null,
        townsFound: result.towns.length,
        townsUpdated,
        durationMs,
      });

      logger.info(
        {
          townsFound: result.towns.length,
          townsUpdated,
          errors: errors.length,
          durationMs,
        },
        'Poll cycle completed',
      );

      return result;
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      await pollRunRepo.complete(pollRun.id, {
        success: false,
        errorMessage,
        townsFound: 0,
        townsUpdated: 0,
        durationMs,
      });

      logger.error({ error: errorMessage, durationMs }, 'Poll cycle failed');

      return {
        towns: [],
        shapes: [],
        pollDurationMs: durationMs,
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Upsert one row per town and one row per nation for today's date.
   * Used for resident trend analytics.
   */
  async function upsertDailySeries(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // Track nation resident totals
    const nationTotals = new Map<string, number>();

    for (const pt of processedTowns) {
      try {
        await townSeriesRepo.upsert(pt.townId, today, pt.residents);
      } catch (error) {
        logger.warn(
          { townId: pt.townId, error: String(error) },
          'Town resident series upsert failed',
        );
      }

      // Accumulate nation totals
      if (pt.nationId) {
        const current = nationTotals.get(pt.nationId) ?? 0;
        nationTotals.set(pt.nationId, current + pt.residents);
      }
    }

    // Upsert nation series
    for (const [nationId, totalResidents] of nationTotals) {
      try {
        await nationSeriesRepo.upsert(nationId, today, totalResidents);
      } catch (error) {
        logger.warn(
          { nationId, error: String(error) },
          'Nation resident series upsert failed',
        );
      }
    }
  }

  return { executePoll };
}
