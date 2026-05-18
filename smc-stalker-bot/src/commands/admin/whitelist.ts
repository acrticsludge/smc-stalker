/**
 * /admin whitelist — Superadmin-only guild whitelist management.
 *
 * Guild name is NOT required — guild ID is the sole source of trust.
 * Uses INSERT ... ON CONFLICT so it works even if the guild hasn't
 * been seen by the bot yet.
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { Sql } from 'postgres';
import { defineCommand } from '../register.js';
import { createGuildRepository } from '../../repositories/guild.repository.js';
import { getAuth } from '../../services/auth.service.js';
import { infoEmbed, successEmbed, dangerEmbed } from '../../lib/embed-builder.js';

export function registerWhitelistCommands(sql: Sql): void {
  const guildRepo = createGuildRepository(sql);

  defineCommand({
    data: new SlashCommandBuilder()
      .setName('admin-whitelist')
      .setDescription('Manage guild whitelist (superadmin only)')
      .addSubcommand((sub) =>
        sub
          .setName('add')
          .setDescription('Whitelist a guild by ID')
          .addStringOption((opt) =>
            opt.setName('guild-id').setDescription('Discord guild ID').setRequired(true),
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

          // INSERT ... ON CONFLICT handles both new and existing guilds
          const guild = await guildRepo.setWhitelisted(guildId, true);

          await interaction.editReply({
            embeds: [
              successEmbed(
                'Guild Whitelisted',
                `Guild \`${guildId}\` (**${guild.name || 'Unknown'}**) is now whitelisted. Ordinary users can now use commands.`,
              ),
            ],
          });
          break;
        }
        case 'remove': {
          const guildId = interaction.options.getString('guild-id', true);

          await guildRepo.setWhitelisted(guildId, false);
          await interaction.editReply({
            embeds: [successEmbed('Guild Removed', `Guild \`${guildId}\` has been removed.`)],
          });
          break;
        }
        case 'list': {
          const guilds = await guildRepo.findWhitelisted();

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
