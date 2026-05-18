/**
 * /access — Request access to use the bot in this guild.
 *
 * Creates a pending request and DMs the superadmin with
 * approve/deny buttons.
 */

import {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { Sql } from 'postgres';
import { defineCommand } from './register.js';
import { createAccessRequestRepository } from '../repositories/access-request.repository.js';
import { createGuildUserRepository } from '../repositories/guild-user.repository.js';
import { SUPERADMIN_ID } from '../config/constants.js';
import { infoEmbed, successEmbed, dangerEmbed } from '../lib/embed-builder.js';
import type { Client } from 'discord.js';

let discordClient: Client | null = null;

export function setDiscordClient(client: Client): void {
  discordClient = client;
}

export function registerAccessCommand(sql: Sql): void {
  const accessRepo = createAccessRequestRepository(sql);
  const userRepo = createGuildUserRepository(sql);

  defineCommand({
    data: new SlashCommandBuilder()
      .setName('access')
      .setDescription('Request access to use bot commands in this server'),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      const guildId = interaction.guildId;
      if (!guildId) {
        await interaction.editReply({
          embeds: [dangerEmbed('Error', 'This command must be used in a server.')],
        });
        return;
      }

      const userId = interaction.user.id;
      const userName = interaction.user.username;

      // Already a guild admin?
      const existingUser = await userRepo.findInGuild(guildId, userId);
      if (existingUser) {
        await interaction.editReply({
          embeds: [infoEmbed('Already Authorized', 'You already have access to this bot in this server.')],
        });
        return;
      }

      // Already has a pending request?
      const pending = await accessRepo.findByUser(guildId, userId);
      if (pending?.status === 'pending') {
        await interaction.editReply({
          embeds: [infoEmbed('Request Pending', 'Your access request is already pending review. Please wait for the superadmin to approve it.')],
        });
        return;
      }

      // Create the request
      const request = await accessRepo.create(guildId, userId, userName);

      // Try to DM the superadmin with approve/deny buttons
      let dmSent = false;
      if (discordClient) {
        try {
          const superadmin = await discordClient.users.fetch(SUPERADMIN_ID);
          const approveBtn = new ButtonBuilder()
            .setCustomId(`approve_access_${request.id}`)
            .setLabel('✅ Approve')
            .setStyle(ButtonStyle.Success);
          const denyBtn = new ButtonBuilder()
            .setCustomId(`deny_access_${request.id}`)
            .setLabel('❌ Deny')
            .setStyle(ButtonStyle.Danger);
          const row = new ActionRowBuilder<ButtonBuilder>().addComponents(approveBtn, denyBtn);

          await superadmin.send({
            embeds: [
              infoEmbed(
                '🔑 Access Request',
                `**User:** ${interaction.user.tag} (\`${userId}\`)\n**Guild:** \`${guildId}\`\n**Requested:** <t:${Math.floor(Date.now() / 1000)}:R>`,
              ),
            ],
            components: [row],
          });
          dmSent = true;
        } catch {
          // DM failed — request is still stored for review via /admin pending-requests
        }
      }

      if (dmSent) {
        await interaction.editReply({
          embeds: [successEmbed('Request Sent', 'Your access request has been sent to the superadmin. You will be notified once approved.')],
        });
      } else {
        await interaction.editReply({
          embeds: [infoEmbed('Request Submitted', 'Your request has been submitted. The superadmin will review it via the pending requests panel.')],
        });
      }
    },
  });
}
