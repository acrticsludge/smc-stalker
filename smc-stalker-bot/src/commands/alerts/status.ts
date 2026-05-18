/**
 * /alert status — View current alert configurations.
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { Sql } from 'postgres';
import { defineCommand } from '../register.js';
import { createAlertConfigRepository } from '../../repositories/alert-config.repository.js';
import { getAuth } from '../../services/auth.service.js';
import { infoEmbed, dangerEmbed } from '../../lib/embed-builder.js';
import { formatTimeGMT } from '../../lib/dates.js';

export function registerAlertStatusCommand(sql: Sql): void {
  const alertRepo = createAlertConfigRepository(sql);

  defineCommand({
    data: new SlashCommandBuilder()
      .setName('alert-status')
      .setDescription('View current alert configurations'),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      const auth = getAuth(interaction);
      if (!auth?.authorized) {
        await interaction.editReply({
          embeds: [dangerEmbed('Access Denied', 'You are not authorized.')],
        });
        return;
      }

      const guildId = interaction.guildId;
      if (!guildId) {
        await interaction.editReply({
          embeds: [dangerEmbed('Error', 'This command must be used in a server.')],
        });
        return;
      }

      const configs = await alertRepo.findByGuild(guildId);

      if (configs.length === 0) {
        await interaction.editReply({
          embeds: [infoEmbed('Alert Configurations', 'No alerts configured for this guild.')],
        });
        return;
      }

      const lines = configs.map((c) => {
        const status = c.enabled ? '✅ Enabled' : '❌ Disabled';
        const channel = `<#${c.channel_id}>`;
        const type = c.type.toUpperCase();
        const nation = c.nation_name ? ` (${c.nation_name})` : '';
        const role = c.role_id ? ` — pings <@&${c.role_id}>` : '';
        const time =
          c.schedule_times.length > 0
            ? ` at ${c.schedule_times.map((t) => formatTimeGMT(t)).join(', ')}`
            : ' (immediate)';
        return `• **${type}**${nation}: ${status} → ${channel}${role}${time}`;
      });

      await interaction.editReply({
        embeds: [infoEmbed('Alert Configurations', lines.join('\n'))],
      });
    },
  });
}
