/**
 * Discord embed builder helpers.
 * All functions accept an optional `color` override.
 * Default: 0x00aaff (blue).
 */

import { EmbedBuilder, type ColorResolvable } from 'discord.js';

const DEFAULT_COLOR: ColorResolvable = 0x00aaff;
const WARNING_COLOR: ColorResolvable = 0xffaa00;
const DANGER_COLOR: ColorResolvable = 0xff4444;
const SUCCESS_COLOR: ColorResolvable = 0x44ff44;

const FOOTER_TEXT = 'SMC Stalker Bot';

function go(
  color: ColorResolvable,
  title: string,
  description?: string,
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description ?? null)
    .setFooter({ text: FOOTER_TEXT })
    .setTimestamp();
}

/** Information embed — default blue or custom color */
export function infoEmbed(
  title: string,
  description?: string,
  color?: ColorResolvable,
): EmbedBuilder {
  return go(color ?? DEFAULT_COLOR, title, description);
}

/** Warning embed — orange */
export function warningEmbed(title: string, description?: string): EmbedBuilder {
  return go(WARNING_COLOR, title, description);
}

/** Danger/error embed — red */
export function dangerEmbed(title: string, description?: string): EmbedBuilder {
  return go(DANGER_COLOR, title, description);
}

/** Success embed — green */
export function successEmbed(title: string, description?: string): EmbedBuilder {
  return go(SUCCESS_COLOR, title, description);
}
