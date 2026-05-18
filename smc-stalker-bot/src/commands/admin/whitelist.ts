/**
 * /admin whitelist — Superadmin-only guild whitelist management.
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

export function registerWhitelistCommands(sql: Sql): void {
  const guildService = createGuildService(sql);

  defineCommand({
    data: new SlashCommandBuilder()
      .setName('admin-whitelist')
      .setDescription('Manage guild whitelist (superadmin only)')
      .addSubcommand((sub) =>
        sub
          .setName('add')
          .setDescription('Whitelist a guild')
          .addStringOption((opt) =>
            opt.setName('guild-id').setDescription('Discord guild ID').setRequired(true),
          )
          .addStringOption((opt) =>
            opt.setName('name').setDescription('Guild name').setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub
          .setName('remove')
          .setDescription('Remove a guild from the whitelist')
          .addStringOption((opt) =>
            opt.setName('guild-id').setDescription('Discord guild ID').setRequired(true),
          ),
      )
      .addSubcommand((sub) =>
        sub.setName('list').setDescription('List all whitelisted guilds'),
      ),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      const auth = getAuth(interaction);
      if (!auth?.isSuperAdmin) {
        await interaction.editReply({
          embeds: [dangerEmbed('Access Denied', 'Only the superadmin can manage whitelists.')],
        });
        return;
      }

      const subcommand = interaction.options.getSubcommand();

      switch (subcommand) {
        case 'add': {
          const guildId = interaction.options.getString('guild-id', true);
          const name = interaction.options.getString('name', true);

          await guildService.whitelistGuild(guildId, name);
          await interaction.editReply({
            embeds: [
              successEmbed(
                'Guild Whitelisted',
                `Guild **${name}** (\`${guildId}\`) has been whitelisted.`,
              ),
            ],
          });
          break;
        }
        case 'remove': {
          const guildId = interaction.options.getString('guild-id', true);

          await guildService.removeGuild(guildId);
          await interaction.editReply({
            embeds: [successEmbed('Guild Removed', `Guild \`${guildId}\` has been removed.`)],
          });
          break;
        }
        case 'list': {
          const guilds = await guildService.listWhitelisted();

          if (guilds.length === 0) {
            await interaction.editReply({
              embeds: [infoEmbed('Whitelisted Guilds', 'No guilds are whitelisted.')],
            });
            return;
          }

          const description = guilds
            .map((g) => `• **${g.name}** (\`${g.id}\`)`)
            .join('\n');

          await interaction.editReply({
            embeds: [
              infoEmbed(
                'Whitelisted Guilds',
                `${description}\n\n**Total:** ${guilds.length}`,
              ),
            ],
          });
          break;
        }
      }
    },
  });
}
