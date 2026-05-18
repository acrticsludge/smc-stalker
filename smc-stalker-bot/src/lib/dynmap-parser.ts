/**
 * Parser for dynmap town detail HTML.
 *
 * The dynmap `detail` field contains HTML like:
 *   <b>TownName</b><br>
 *   Mayor: MayorName<br>
 *   Residents: N<br>
 *   Resident Names: name1, name2, ...<br>
 *   Nation: NationName<br>
 *   Status: peaceful|unpeaceful<br>
 *   Founded: YYYY-MM-DD<br>
 *   Bank: XXXX.XX<br>
 *   Upkeep: XXX.XX/day
 */

import { z } from 'zod';
import type { ParsedTownData } from '../types/dynmap.js';
import { createLogger } from './logger.js';

const logger = createLogger('dynmap-parser');

const FIELD_REGEX = /^(Mayor|Residents|Resident Names|Nation|Status|Founded|Bank|Upkeep):\s*(.+)$/m;

/** Extracted field values from a detail HTML string */
interface ExtractedFields {
  mayor: string;
  residents: number;
  residentNames: string[];
  nation: string | null;
  status: string | null;
  founded: string | null;
  bank: number;
  upkeep: number;
}

/**
 * Parse town data from a dynmap marker's HTML detail field.
 *
 * Returns null if the detail doesn't contain a town name (e.g. outskirts).
 */
export function parseTownDataFromDetail(
  detail: string,
  fallbackName: string,
): ParsedTownData | null {
  const nameMatch = /<b>(.+?)<\/b>/i.exec(detail);
  const name = nameMatch?.[1]?.trim() ?? fallbackName;

  if (!name) {
    return null;
  }

  const fields = extractFields(detail);

  // Validate with Zod
  const result = parsedTownSchema.safeParse({
    name,
    mayor: fields.mayor,
    residents: fields.residents,
    residentNames: fields.residentNames,
    nation: fields.nation,
    status: fields.status,
    founded: fields.founded,
    bank: fields.bank,
    upkeep: fields.upkeep,
  });

  if (!result.success) {
    logger.warn(
      { town: name, issues: result.error.issues },
      'Failed to validate parsed town data',
    );
    return null;
  }

  return result.data;
}

/**
 * Extract field values from the detail HTML.
 */
function extractFields(detail: string): ExtractedFields {
  const result: ExtractedFields = {
    mayor: '',
    residents: 0,
    residentNames: [],
    nation: null,
    status: null,
    founded: null,
    bank: 0,
    upkeep: 0,
  };

  const lines = detail.split('<br>');

  for (const line of lines) {
    const match = FIELD_REGEX.exec(line);
    if (!match) continue;

    const key = match[1]!;
    const value: string = match[2]!.trim();

    switch (key) {
      case 'Mayor':
        result.mayor = value;
        break;
      case 'Residents':
        result.residents = Number.parseInt(value, 10) || 0;
        break;
      case 'Resident Names':
        result.residentNames = value
          .split(',')
          .map((n) => n.trim())
          .filter((n) => n.length > 0);
        break;
      case 'Nation':
        result.nation = value === 'None' ? null : value;
        break;
      case 'Status':
        result.status = ['peaceful', 'unpeaceful'].includes(value)
          ? value
          : null;
        break;
      case 'Founded':
        result.founded = value;
        break;
      case 'Bank':
        result.bank = Number.parseFloat(value.replace(/[$,]/g, '')) || 0;
        break;
      case 'Upkeep':
        result.upkeep = Number.parseFloat(
          value.replace(/[$,]/g, '').replace(/\/day$/, ''),
        ) || 0;
        break;
    }
  }

  return result;
}

// ── Zod validation schema ──────────────────────────────

const parsedTownSchema = z.object({
  name: z.string().min(1),
  mayor: z.string(),
  residents: z.number().int().min(0),
  residentNames: z.array(z.string()),
  nation: z.string().nullable(),
  status: z.string().nullable(),
  founded: z
    .string()
    .nullable()
    .refine((val) => val === null || /^\d{4}-\d{2}-\d{2}$/.test(val), {
      message: 'Founded must be a date in YYYY-MM-DD format',
    }),
  bank: z.number().min(0),
  upkeep: z.number().min(0),
});
