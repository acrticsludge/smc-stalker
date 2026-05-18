/**
 * /admin pending-requests — Review pending access requests (superadmin only).
 */

import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { Sql } from 'postgres';
import { defineCommand } from '../register.js';
import { createAccessRequestRepository } from '../../repositories/access-request.repository.js';
import { getAuth } from '../../services/auth.service.js';
import { infoEmbed, dangerEmbed } from '../../lib/embed-builder.js';

export function registerPendingRequestsCommand(sql: Sql): void {
  const accessRepo = createAccessRequestRepository(sql);

  defineCommand({
    data: new SlashCommandBuilder()
      .setName('admin-pending')
      .setDescription('Review pending access requests (superadmin only)'),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      const auth = getAuth(interaction);
      if (!auth?.isSuperAdmin) {
        await interaction.editReply({
          embeds: [dangerEmbed('Access Denied', 'Only the superadmin can review requests.')],
        });
        return;
      }

      const pending = await accessRepo.findAllPending();

      if (pending.length === 0) {
        await interaction.editReply({
          embeds: [infoEmbed('Pending Requests', 'No pending access requests.')],
        });
        return;
      }

      // Show first 10 pending requests with inline approve/deny buttons
      const batch = pending.slice(0, 10);
      const lines = batch.map(
        (r) =>
          `• **${r.user_name}** (\`${r.user_id}\`) — Guild \`${r.guild_id}\` — <t:${Math.floor(new Date(r.created_at).getTime() / 1000)}:R>`,
      );

      const embed = infoEmbed(
        `Pending Access Requests (${pending.length})`,
        lines.join('\n'),
      );

      // Build approve/deny buttons for the first request
      const first = batch[0]!;
      const approveBtn = new ButtonBuilder()
        .setCustomId(`approve_access_${first.id}`)
        .setLabel(`✅ Approve ${first.user_name}`)
        .setStyle(ButtonStyle.Success);
      const denyBtn = new ButtonBuilder()
        .setCustomId(`deny_access_${first.id}`)
        .setLabel(`❌ Deny ${first.user_name}`)
        .setStyle(ButtonStyle.Danger);
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(approveBtn, denyBtn);

      await interaction.editReply({
        embeds: [embed],
        components: [row],
      });
    },
  });
}
