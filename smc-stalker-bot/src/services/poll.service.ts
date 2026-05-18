/**
 * Poll service — orchestrates fetching dynmap data and persisting it.
 *
 * Uses sequential non-transactional writes. If one town fails, the others
 * still get saved. This avoids TransactionSql/Sql type incompatibility
 * and allows partial success tolerance.
 */

import type { Sql } from 'postgres';
import { createDynmapClient } from '../lib/dynmap-client.js';
import { createLogger } from '../lib/logger.js';
import { createNationRepository } from '../repositories/nation.repository.js';
import { createTownRepository } from '../repositories/town.repository.js';
import { createTownSnapshotRepository } from '../repositories/town-snapshot.repository.js';
import { createTerritoryShapeRepository } from '../repositories/territory-shape.repository.js';
import { createPollRunRepository } from '../repositories/poll-run.repository.js';
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

  /**
   * Execute a full poll cycle:
   *  1. Fetch dynmap data
   *  2. Upsert nations and towns (sequentially)
   *  3. Create snapshots
   *  4. Upsert territory shapes
   *  5. Record poll run
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

      // Process each town sequentially (intentional — keeps operations simple
      // and avoids TransactionSql/Sql type issues)
      for (const town of result.towns) {
        try {
          // Upsert nation first
          let nationId: string | null = null;
          if (town.nation) {
            const nation = await nationRepo.upsert(town.nation);
            nationId = nation.id;
          }

          // Upsert town
          const savedTown = await townRepo.upsert({
            name: town.name,
            mayor: town.mayor,
            residents: town.residents,
            nationId,
            founded: town.founded,
            bank: town.bank,
            upkeep: town.upkeep,
          });

          // Create historical snapshot
          await snapshotRepo.create({
            townId: savedTown.id,
            mayor: town.mayor,
            residents: town.residents,
            nationId,
            bank: town.bank,
            upkeep: town.upkeep,
          });

          townsUpdated++;
        } catch (error) {
          const msg = `Failed to process town ${town.name}: ${String(error)}`;
          errors.push(msg);
          logger.warn({ town: town.name, error: String(error) }, 'Town processing failed');
        }
      }

      // Upsert territory shapes (separate loop to avoid blocking town processing)
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

  return { executePoll };
}
