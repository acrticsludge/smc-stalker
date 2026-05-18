/**
 * /help — List all available commands with descriptions.
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { Sql } from 'postgres';
import { defineCommand } from './register.js';
import { infoEmbed } from '../lib/embed-builder.js';

const HELP_CATEGORIES = [
  {
    name: '📋 Upkeep Commands',
    commands: [
      { name: '/upkeep-town <name>', desc: 'View a town\'s bank, upkeep cost, days until insolvent, and other stats.' },
      { name: '/upkeep-nation <name>', desc: 'View a nation\'s aggregate upkeep overview — totals, averages, at-risk towns.' },
      { name: '/list towns', desc: 'List all towns with pagination (bank, upkeep, residents).' },
      { name: '/list nations', desc: 'List all tracked nations with pagination.' },
    ],
  },
  {
    name: '🔔 Alert Commands',
    commands: [
      { name: '/alert-configure upkeep create', desc: 'Set up scheduled upkeep alerts — choose channel, threshold days, and role to ping.' },
      { name: '/alert-configure friendly add|remove|list', desc: 'Manage the friendly-nation watchlist for low-funds alerts.' },
      { name: '/alert-configure enemy add|remove|list', desc: 'Manage the enemy-nation watchlist for activity change detection.' },
      { name: '/alert-status', desc: 'View all active alert configurations for this server.' },
      { name: '/alerts', desc: 'Unified overview — all alert configs plus friendly/enemy nation lists.' },
    ],
  },
  {
    name: '🛠️ Admin Commands (superadmin only)',
    commands: [
      { name: '/admin-whitelist add', desc: 'Add a Discord server to the bot whitelist.' },
      { name: '/admin-whitelist remove', desc: 'Remove a server from the whitelist.' },
      { name: '/admin-whitelist list', desc: 'List all whitelisted servers.' },
      { name: '/admin-admin add', desc: 'Promote a user to guild admin (they can configure alerts).' },
      { name: '/admin-admin remove', desc: 'Remove guild admin status from a user.' },
      { name: '/admin-admin list', desc: 'List all admins for a guild.' },
      { name: '/admin-inspect', desc: 'View full configuration details for a guild.' },
      { name: '/admin-toggle-auth', desc: 'Enable or disable auth checks for a guild (open access mode).' },
    ],
  },
  {
    name: 'ℹ️ Other',
    commands: [
      { name: '/help', desc: 'Show this command reference.' },
    ],
  },
];

export function registerHelpCommand(_sql: Sql): void {
  defineCommand({
    data: new SlashCommandBuilder()
      .setName('help')
      .setDescription('Show all available commands and their usage'),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      const lines: string[] = [];

      for (const category of HELP_CATEGORIES) {
        lines.push(`**${category.name}**`);
        for (const cmd of category.commands) {
          lines.push(`\`${cmd.name}\` — ${cmd.desc}`);
        }
        lines.push('');
      }

      const embed = infoEmbed(
        'SMC Stalker Bot — Command Reference',
        lines.join('\n'),
      );

      await interaction.editReply({ embeds: [embed] });
    },
  });
}
