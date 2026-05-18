/**
 * /at-risk <days> — List all towns that will go bankrupt within N days,
 * always showing nation name.
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

export function registerAtRiskCommand(sql: Sql): void {
  const townRepo = createTownRepository(sql);
  const nationRepo = createNationRepository(sql);

  defineCommand({
    data: new SlashCommandBuilder()
      .setName('at-risk')
      .setDescription('List all towns that will go bankrupt within N days')
      .addIntegerOption((opt) =>
        opt
          .setName('days')
          .setDescription('Number of days (towns with bank < upkeep × N)')
          .setRequired(true)
          .setMinValue(1),
      ),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      const days = interaction.options.getInteger('days', true);
      const channel = interaction.channel;

      if (!channel || !('guild' in channel)) {
        await interaction.editReply({
          embeds: [infoEmbed('Error', 'This command must be used in a server channel.')],
        });
        return;
      }

      // Fetch all towns and build nation map
      const [allTowns, allNations] = await Promise.all([
        townRepo.findAll(),
        nationRepo.findAll(),
      ]);
      const nationMap = new Map(allNations.map((n) => [n.id, n.name]));

      // Filter towns at risk
      const atRisk = allTowns.filter(
        (t) => t.upkeep > 0 && t.bank < t.upkeep * days,
      );

      if (atRisk.length === 0) {
        await interaction.editReply({
          embeds: [
            infoEmbed(
              '🏦 At-Risk Towns',
              `No towns are at risk of bankruptcy within **${days} days**.`,
            ),
          ],
        });
        return;
      }

      // Sort by days remaining (most urgent first)
      atRisk.sort((a, b) => {
        const aDays = a.upkeep > 0 ? a.bank / a.upkeep : 999;
        const bDays = b.upkeep > 0 ? b.bank / b.upkeep : 999;
        return aDays - bDays;
      });

      // Build paginated pages
      const pages = [];
      for (let i = 0; i < atRisk.length; i += ITEMS_PER_PAGE) {
        const chunk = atRisk.slice(i, i + ITEMS_PER_PAGE);
        const description = chunk
          .map((t) => {
            const nationName = t.nation_id ? (nationMap.get(t.nation_id) ?? 'Unknown') : 'None';
            const daysLeft = t.upkeep > 0 ? Math.floor(t.bank / t.upkeep) : 999;
            return (
              `• **${t.name}** [${nationName}] — ` +
              `$${t.upkeep.toFixed(2)}/day, bank: $${t.bank.toFixed(2)}, ` +
              `**${daysLeft} day${daysLeft === 1 ? '' : 's'}** left`
            );
          })
          .join('\n');

        pages.push({
          embeds: [
            infoEmbed(
              `🏦 At-Risk Towns (${i + 1}–${Math.min(i + ITEMS_PER_PAGE, atRisk.length)} of ${atRisk.length}) — threshold: ${days} day${days === 1 ? '' : 's'}`,
              description,
            ),
          ],
        });
      }

      await interaction.deleteReply();
      await sendPaginated(channel, pages, interaction.user.id);
    },
  });
}
