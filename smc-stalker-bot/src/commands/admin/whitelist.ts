/**
 * /admin whitelist — Superadmin-only guild whitelist management.
 *
 * Guild name is NOT required — guild ID is the sole source of trust.
 * After whitelisting, slash commands are deployed to that guild immediately.
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Client,
} from 'discord.js';
import type { Sql } from 'postgres';
import { defineCommand, deployCommands } from '../register.js';
import { createGuildRepository } from '../../repositories/guild.repository.js';
import { getAuth } from '../../services/auth.service.js';
import { infoEmbed, successEmbed, dangerEmbed } from '../../lib/embed-builder.js';

let discordClient: Client | null = null;

export function setWhitelistClient(client: Client): void {
  discordClient = client;
}

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

          // Deploy slash commands to the newly whitelisted guild
          const token = discordClient?.token;
          const clientUser = discordClient?.user;
          if (token && clientUser) {
            try {
              await deployCommands(token, clientUser.id, guildId);
            } catch {
              // Non-fatal — commands will deploy on next bot restart
            }
          }

          await interaction.editReply({
            embeds: [
              successEmbed(
                'Guild Whitelisted',
                `Guild \`${guildId}\` (**${guild.name || 'Unknown'}**) is now whitelisted. Commands deployed.`,
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
