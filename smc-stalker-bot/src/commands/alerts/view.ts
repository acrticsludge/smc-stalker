/**
 * /alerts — Unified view of all alert configurations and
 * tracked nations for the current guild.
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { Sql } from 'postgres';
import { defineCommand } from '../register.js';
import { createAlertConfigRepository } from '../../repositories/alert-config.repository.js';
import { createGuildConfigRepository } from '../../repositories/guild-config.repository.js';
import { getAuth } from '../../services/auth.service.js';
import { infoEmbed, dangerEmbed } from '../../lib/embed-builder.js';

export function registerAlertsViewCommand(sql: Sql): void {
  const alertRepo = createAlertConfigRepository(sql);
  const configRepo = createGuildConfigRepository(sql);

  defineCommand({
    data: new SlashCommandBuilder()
      .setName('alerts')
      .setDescription('View all alert configs and tracked nations for this guild'),
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

      const [configs, friendlyNations, enemyNations] = await Promise.all([
        alertRepo.findByGuild(guildId),
        configRepo.getTyped<string[]>(guildId, 'friendly_nations'),
        configRepo.getTyped<string[]>(guildId, 'enemy_nations'),
      ]);

      const sections: string[] = [];

      // ── Auth status ─────────────────────────────────
      const authEnabled = await configRepo.getTyped<boolean>(guildId, 'auth_enabled');
      if (authEnabled === false) {
        sections.push('**🔓 Auth:** Disabled — open access');
      }

      // ── Alert configs ───────────────────────────────
      if (configs.length === 0) {
        sections.push('**🔔 Alert Configs:** None configured');
      } else {
        const alertLines = configs.map((c) => {
          const status = c.enabled ? '✅' : '❌';
          const type = c.type.toUpperCase();
          const nation = c.nation_name ? ` (${c.nation_name})` : '';
          const channel = `<#${c.channel_id}>`;
          const role = c.role_id ? ` — pings <@&${c.role_id}>` : '';
          const time =
            c.schedule_times.length > 0
              ? ` at **${c.schedule_times.join(', ')}**`
              : ' (immediate)';
          return `• ${status} **${type}**${nation} → ${channel}${role}${time}`;
        });
        sections.push(`**🔔 Alert Configs:**\n${alertLines.join('\n')}`);
      }

      // ── Friendly nations ────────────────────────────
      if (friendlyNations && friendlyNations.length > 0) {
        sections.push(
          `**🤝 Friendly Nations:** ${friendlyNations.map((n) => `\`${n}\``).join(', ')}`,
        );
      } else {
        sections.push('**🤝 Friendly Nations:** None tracked');
      }

      // ── Enemy nations ───────────────────────────────
      if (enemyNations && enemyNations.length > 0) {
        sections.push(
          `**⚔️ Enemy Nations:** ${enemyNations.map((n) => `\`${n}\``).join(', ')}`,
        );
      } else {
        sections.push('**⚔️ Enemy Nations:** None tracked');
      }

      const embed = infoEmbed('📋 Alert Overview', sections.join('\n\n'));

      await interaction.editReply({ embeds: [embed] });
    },
  });
}
