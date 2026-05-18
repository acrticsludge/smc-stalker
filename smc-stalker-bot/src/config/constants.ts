/**
 * Bot-wide constants.
 *
 * Only ONE value is hardcoded: the Discord superadmin user ID.
 * Everything else must be database-driven, env-driven, or config-driven.
 */

export const SUPERADMIN_ID = '701660839299776593' as const;

export const BOT_NAME = 'SMC Stalker' as const;
export const BOT_VERSION = '1.0.0' as const;

export const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/** How many failed polls before marking data as stale */
export const STALE_POLL_THRESHOLD = 3;
