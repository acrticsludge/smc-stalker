/**
 * /admin inspect — Superadmin-only guild inspection.
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { Sql } from 'postgres';
import { defineCommand } from '../register.js';
import { createGuildService } from '../../services/guild.service.js';
import { getAuth } from '../../services/auth.service.js';
import { infoEmbed, dangerEmbed } from '../../lib/embed-builder.js';

export function registerInspectCommand(sql: Sql): void {
  const guildService = createGuildService(sql);

  defineCommand({
    data: new SlashCommandBuilder()
      .setName('admin-inspect')
      .setDescription('Inspect a guild configuration (superadmin only)')
      .addStringOption((opt) =>
        opt.setName('guild-id').setDescription('Discord guild ID').setRequired(true),
      ),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      const auth = getAuth(interaction);
      if (!auth?.isSuperAdmin) {
        await interaction.editReply({
          embeds: [dangerEmbed('Access Denied', 'Only the superadmin can inspect guilds.')],
        });
        return;
      }

      const guildId = interaction.options.getString('guild-id', true);
      const result = await guildService.inspectGuild(guildId);

      if (!result.guild) {
        await interaction.editReply({
          embeds: [dangerEmbed('Not Found', `Guild \`${guildId}\` is not in the database.`)],
        });
        return;
      }

      const embed = infoEmbed(
        `Guild: ${result.guild.name}`,
        [
          `**ID:** \`${result.guild.id}\``,
          `**Whitelisted:** ${result.guild.is_whitelisted ? '✅' : '❌'}`,
          `**Admins:** ${result.admins.length}`,
          `**Authorized Roles:** ${result.roles.length}`,
          `**Config Keys:** ${result.configs.length}`,
          `**Created:** ${new Date(result.guild.created_at).toLocaleString()}`,
        ].join('\n'),
      );

      await interaction.editReply({ embeds: [embed] });
    },
  });
}
