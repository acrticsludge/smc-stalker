/**
 * /list — List towns or nations with pagination.
 * Towns always show their nation name.
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
import { formatDateLongGMT } from '../../lib/dates.js';
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

      if (!interaction.channel || !('guild' in interaction.channel)) {
        await interaction.editReply({
          embeds: [infoEmbed('Error', 'This command must be used in a server channel.')],
        });
        return;
      }
      const channel = interaction.channel;

      if (subcommand === 'towns') {
        const [towns, allNations] = await Promise.all([
          townRepo.findAll(),
          nationRepo.findAll(),
        ]);
        const nationMap = new Map(allNations.map((n) => [n.id, n.name]));

        if (towns.length === 0) {
          await interaction.editReply({
            embeds: [infoEmbed('Towns', 'No towns found.')],
          });
          return;
        }

        const pages = [];
        for (let i = 0; i < towns.length; i += ITEMS_PER_PAGE) {
          const chunk = towns.slice(i, i + ITEMS_PER_PAGE);
          const description = chunk
            .map((t) => {
              const nationName = t.nation_id
                ? (nationMap.get(t.nation_id) ?? 'Unknown')
                : 'None';
              return (
                `• **${t.name}** [${nationName}] — ` +
                `$${t.upkeep.toFixed(2)}/day, bank: $${t.bank.toFixed(2)}, res: ${t.residents}`
              );
            })
            .join('\n');

          pages.push({
            embeds: [
              infoEmbed(
                `Towns (${i + 1}–${Math.min(i + ITEMS_PER_PAGE, towns.length)} of ${towns.length})`,
                description,
              ),
            ],
          });
        }

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
                `• **${n.name}** — Last seen: ${formatDateLongGMT(n.last_seen_at)}`,
            )
            .join('\n');

          pages.push({
            embeds: [
              infoEmbed(
                `Nations (${i + 1}–${Math.min(i + ITEMS_PER_PAGE, nations.length)} of ${nations.length})`,
                description,
              ),
            ],
          });
        }

        await interaction.deleteReply();
        await sendPaginated(channel, pages, interaction.user.id);
      }
    },
  });
}
