/**
 * /list — List towns or nations with pagination.
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { Sql } from 'postgres';
import { defineCommand } from '../register.js';
import { createTownRepository } from '../../repositories/town.repository.js';
import { createNationRepository } from '../../repositories/nation.repository.js';
import { infoEmbed } from '../../lib/embed-builder.js';
import { sendPaginated } from '../../lib/pagination.js';

const ITEMS_PER_PAGE = 15;

export function registerListCommands(sql: Sql): void {
  const townRepo = createTownRepository(sql);
  const nationRepo = createNationRepository(sql);

  defineCommand({
    data: new SlashCommandBuilder()
      .setName('list')
      .setDescription('List towns or nations')
      .addSubcommand((sub) => sub.setName('towns').setDescription('List all towns'))
      .addSubcommand((sub) => sub.setName('nations').setDescription('List all nations')),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      const subcommand = interaction.options.getSubcommand();

      // Paginated list commands need a guild text channel
      if (!interaction.channel || !('guild' in interaction.channel)) {
        await interaction.editReply({
          embeds: [infoEmbed('Error', 'This command must be used in a server channel.')],
        });
        return;
      }
      const channel = interaction.channel;

      if (subcommand === 'towns') {
        const towns = await townRepo.findAll();

        if (towns.length === 0) {
          await interaction.editReply({
            embeds: [infoEmbed('Towns', 'No towns found.')],
          });
          return;
        }

        // Build paginated pages
        const pages = [];
        for (let i = 0; i < towns.length; i += ITEMS_PER_PAGE) {
          const chunk = towns.slice(i, i + ITEMS_PER_PAGE);
          const description = chunk
            .map(
              (t) =>
                `• **${t.name}** — $${t.upkeep.toFixed(2)}/day | Bank: $${t.bank.toFixed(2)} | Residents: ${t.residents}`,
            )
            .join('\n');

          pages.push({
            embeds: [
              infoEmbed(
                `Towns (${i + 1}-${Math.min(i + ITEMS_PER_PAGE, towns.length)} of ${towns.length})`,
                description,
              ),
            ],
          });
        }

        // Delete defer reply and send paginated message
        if (pages.length > 0) {
          await interaction.deleteReply();
          await sendPaginated(channel, pages, interaction.user.id);
        }
      } else if (subcommand === 'nations') {
        const nations = await nationRepo.findAll();

        if (nations.length === 0) {
          await interaction.editReply({
            embeds: [infoEmbed('Nations', 'No nations found.')],
          });
          return;
        }

        const pages = [];
        for (let i = 0; i < nations.length; i += ITEMS_PER_PAGE) {
          const chunk = nations.slice(i, i + ITEMS_PER_PAGE);
          const description = chunk
            .map(
              (n) =>
                `• **${n.name}** — Last seen: <t:${Math.floor(new Date(n.last_seen_at).getTime() / 1000)}:R>`,
            )
            .join('\n');

          pages.push({
            embeds: [
              infoEmbed(
                `Nations (${i + 1}-${Math.min(i + ITEMS_PER_PAGE, nations.length)} of ${nations.length})`,
                description,
              ),
            ],
          });
        }

        // Delete defer reply and send paginated message
        await interaction.deleteReply();
        await sendPaginated(channel, pages, interaction.user.id);
      }
    },
  });
}
