/**
 * /admin admin — Superadmin-only guild admin management.
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { Sql } from 'postgres';
import { defineCommand } from '../register.js';
import { createGuildService } from '../../services/guild.service.js';
import { getAuth } from '../../services/auth.service.js';
import { infoEmbed, successEmbed, dangerEmbed } from '../../lib/embed-builder.js';

export function registerAdminCommands(sql: Sql): void {
  const guildService = createGuildService(sql);

  defineCommand({
    data: new SlashCommandBuilder()
      .setName('admin-admin')
      .setDescription('Manage guild admins (superadmin only)')
      .addSubcommand((sub) =>
        sub
          .setName('add')
          .setDescription('Add a guild admin')
          .addStringOption((opt) =>
            opt.setName('guild-id').setDescription('Discord guild ID').setRequired(true),
          )
          .addUserOption((opt) =>
            opt.setName('user').setDescription('Discord user').setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('remove')
          .setDescription('Remove a guild admin')
          .addStringOption((opt) =>
            opt.setName('guild-id').setDescription('Discord guild ID').setRequired(true),
          )
          .addUserOption((opt) =>
            opt.setName('user').setDescription('Discord user').setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('list')
          .setDescription('List admins for a guild')
          .addStringOption((opt) =>
            opt.setName('guild-id').setDescription('Discord guild ID').setRequired(true),
          ),
      ),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      const auth = getAuth(interaction);
      if (!auth?.isSuperAdmin) {
        await interaction.editReply({
          embeds: [dangerEmbed('Access Denied', 'Only the superadmin can manage admins.')],
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case 'add': {
          const guildId = interaction.options.getString('guild-id', true);
          const user = interaction.options.getUser('user', true);

          await guildService.addAdmin(guildId, user.id);
          await interaction.editReply({
            embeds: [
              successEmbed(
                'Admin Added',
                `<@${user.id}> is now a guild admin for \`${guildId}\`.`,
              ),
            ],
          });
          break;
        }
        case 'remove': {
          const guildId = interaction.options.getString('guild-id', true);
          const user = interaction.options.getUser('user', true);

          await guildService.removeAdmin(guildId, user.id);
          await interaction.editReply({
            embeds: [
              successEmbed(
                'Admin Removed',
                `<@${user.id}> is no longer a guild admin for \`${guildId}\`.`,
              ),
            ],
          });
          break;
        }
        case 'list': {
          const guildId = interaction.options.getString('guild-id', true);
          const admins = await guildService.listAdmins(guildId);

          if (admins.length === 0) {
            await interaction.editReply({
              embeds: [infoEmbed('Guild Admins', `No admins for guild \`${guildId}\`.`)], 
            });
            return;
          }

          const description = admins
            .map((a) => `• <@${a.discord_id}> (\`${a.discord_id}\`)`)
            .join('\n');

          await interaction.editReply({
            embeds: [infoEmbed(`Guild Admins (\`${guildId}\`)`, description)],
          });
          break;
        }
      }
    },
  });
}
