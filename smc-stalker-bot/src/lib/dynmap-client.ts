/**
 * HTTP client for fetching dynmap markers.json data.
 */

import { z } from 'zod';
import { withRetry } from './retry.js';
import type { DynmapResponse, DynmapPollResult } from '../types/dynmap.js';
import { parseTownDataFromDetail } from './dynmap-parser.js';
import { createLogger } from './logger.js';

const logger = createLogger('dynmap-client');

// ── Zod validation schemas ─────────────────────────────

const vertexSchema = z.object({
  x: z.number(),
  z: z.number(),
});

const markerSchema = z.object({
  shape: z.array(vertexSchema),
  holes: z.array(z.array(vertexSchema)).default([]),
  shapeY: z.number().default(64),
  label: z.string(),
  detail: z.string(),
});

const markerSetSchema = z.object({
  markers: z.record(z.string(), markerSchema),
});

const dynmapResponseSchema = z.object({
  townybluemap_claims: markerSetSchema,
  outskirts: markerSetSchema.optional(),
});

export interface DynmapClientConfig {
  url: string;
  timeoutMs: number;
}

/**
 * Create a dynmap HTTP client.
 */
export function createDynmapClient(config: DynmapClientConfig) {
  /**
   * Fetch and parse the dynmap markers.json endpoint.
   * Returns the raw response and poll metadata.
   */
  async function fetchMarkers(): Promise<DynmapPollResult> {
    const startTime = Date.now();

    try {
      const response = await withRetry(
        async () => {
          const controller = new AbortController();
          const timeout = setTimeout(() => { controller.abort(); }, config.timeoutMs);

          try {
            const res = await fetch(config.url, {
              signal: controller.signal,
              headers: { Accept: 'application/json' },
            });

            if (!res.ok) {
              throw new Error(`Dynmap returned HTTP ${res.status}: ${res.statusText}`);
            }

            const text = await res.text();
            return { text, headers: res.headers };
          } finally {
            clearTimeout(timeout);
          }
        },
        { maxAttempts: 3, baseDelayMs: 2000, maxDelayMs: 15000 },
      );

      // Parse JSON
      let rawJson: unknown;
      try {
        rawJson = JSON.parse(response.text) as unknown;
      } catch {
        throw new Error('Failed to parse dynmap response as JSON');
      }

      // Validate structure
      const parsed = dynmapResponseSchema.safeParse(rawJson);
      if (!parsed.success) {
        logger.warn(
          { issues: parsed.error.issues },
          'Dynmap response validation had issues — some data may be missing',
        );
      }

      const claimMarkers = parsed.success
        ? parsed.data.townybluemap_claims.markers
        : (rawJson as DynmapResponse).townybluemap_claims.markers;

      const markerEntries = Object.entries(claimMarkers);

      // Parse each marker
      const towns = [];
      const shapes = [];

      for (const [key, marker] of markerEntries) {
        // Extract region index from marker key (e.g. "Mallorca_region_0" → 0)
        const regionRegex = /_region_(\d+)$/;
        const regionMatch = regionRegex.exec(key);
        const regionIndex = regionMatch ? Number.parseInt(regionMatch[1]!, 10) : 0;

        // Town name is the label
        const townName = marker.label;

        // Parse HTML detail
        const parsedTown = parseTownDataFromDetail(marker.detail, townName);
        if (parsedTown) {
          towns.push(parsedTown);
        }

        shapes.push({
          townName,
          regionIndex,
          markerKey: key,
          shape: marker.shape,
          holes: marker.holes,
          shapeY: marker.shapeY,
        });
      }

      const durationMs = Date.now() - startTime;

      logger.info(
        {
          townsFound: towns.length,
          shapesFound: shapes.length,
          durationMs,
        },
        'Dynmap poll completed',
      );

      return {
        towns,
        shapes,
        pollDurationMs: durationMs,
        success: true,
        error: null,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error({ error: errorMessage, durationMs }, 'Dynmap poll failed');

      return {
        towns: [],
        shapes: [],
        pollDurationMs: durationMs,
        success: false,
        error: errorMessage,
      };
    }
  }

  return { fetchMarkers };
}
