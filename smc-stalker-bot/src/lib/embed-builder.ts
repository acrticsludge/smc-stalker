/**
 * Discord embed builder helpers for consistent embed formatting.
 */

import { EmbedBuilder, type ColorResolvable } from 'discord.js';

const PRIMARY_COLOR: ColorResolvable = 0x00aaff;
const WARNING_COLOR: ColorResolvable = 0xffaa00;
const DANGER_COLOR: ColorResolvable = 0xff4444;
const SUCCESS_COLOR: ColorResolvable = 0x44ff44;

const FOOTER_TEXT = 'SMC Stalker Bot';

/**
 * Create a standard information embed.
 */
export function infoEmbed(title: string, description?: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(PRIMARY_COLOR)
    .setTitle(title)
    .setDescription(description ?? null)
    .setFooter({ text: FOOTER_TEXT })
    .setTimestamp();
}

/**
 * Create a warning embed.
 */
export function warningEmbed(title: string, description?: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(WARNING_COLOR)
    .setTitle(title)
    .setDescription(description ?? null)
    .setFooter({ text: FOOTER_TEXT })
    .setTimestamp();
}

/**
 * Create a danger/error embed.
 */
export function dangerEmbed(title: string, description?: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(DANGER_COLOR)
    .setTitle(title)
    .setDescription(description ?? null)
    .setFooter({ text: FOOTER_TEXT })
    .setTimestamp();
}

/**
 * Create a success embed.
 */
export function successEmbed(title: string, description?: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(SUCCESS_COLOR)
    .setTitle(title)
    .setDescription(description ?? null)
    .setFooter({ text: FOOTER_TEXT })
    .setTimestamp();
}
