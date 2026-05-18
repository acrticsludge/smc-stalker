/**
 * /upkeep-nation — View a nation's upkeep overview with total residents,
 * total upkeep, and optionally list at-risk towns within N days.
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { Sql } from 'postgres';
import { defineCommand } from '../register.js';
import { createNationRepository } from '../../repositories/nation.repository.js';
import { createTownRepository } from '../../repositories/town.repository.js';
import { infoEmbed, dangerEmbed } from '../../lib/embed-builder.js';
import { formatDateLongGMT } from '../../lib/dates.js';

export function registerUpkeepNationCommand(sql: Sql): void {
  const nationRepo = createNationRepository(sql);
  const townRepo = createTownRepository(sql);

  defineCommand({
    data: new SlashCommandBuilder()
      .setName('upkeep-nation')
      .setDescription('View a nation\'s upkeep overview and at-risk towns')
      .addStringOption((opt) =>
        opt.setName('name').setDescription('Nation name').setRequired(true),
      )
      .addIntegerOption((opt) =>
        opt
          .setName('days')
          .setDescription('Show towns at risk within N days (default: show summary)')
          .setRequired(false)
          .setMinValue(1),
      ),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      const name = interaction.options.getString('name', true);
      const thresholdDays = interaction.options.getInteger('days');

      const nation = await nationRepo.findByName(name);
      if (!nation) {
        await interaction.editReply({
          embeds: [dangerEmbed('Nation Not Found', `No nation named **${name}** found.`)],
        });
        return;
      }

      const towns = await townRepo.findByNation(nation.id);

      if (towns.length === 0) {
        await interaction.editReply({
          embeds: [infoEmbed(`🏛️ ${name}`, 'This nation has no towns.')],
        });
        return;
      }

      const totalBank = towns.reduce((sum, t) => sum + t.bank, 0);
      const totalUpkeep = towns.reduce((sum, t) => sum + t.upkeep, 0);
      const totalResidents = towns.reduce((sum, t) => sum + t.residents, 0);
      const atRiskCount = towns.filter(
        (t) => t.upkeep > 0 && t.bank < t.upkeep * 7,
      ).length;

      const lines: string[] = [
        `**Towns:** ${towns.length}`,
        `**Total Residents:** ${totalResidents.toLocaleString()}`,
        `**Total Upkeep:** $${totalUpkeep.toLocaleString(undefined, { minimumFractionDigits: 2 })}/day`,
        `**Total Bank:** $${totalBank.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        `**Average Bank/Town:** $${(totalBank / towns.length).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        `**Average Upkeep/Town:** $${(totalUpkeep / towns.length).toLocaleString(undefined, { minimumFractionDigits: 2 })}/day`,
        `**Towns at Risk (< 7 days):** ${atRiskCount}`,
        `**Last Seen:** ${formatDateLongGMT(nation.last_seen_at)}`,
      ];

      // List at-risk towns if a threshold was provided
      if (thresholdDays) {
        const atRiskTowns = towns
          .filter((t) => t.upkeep > 0 && t.bank < t.upkeep * thresholdDays)
          .sort((a, b) => {
            const aDays = a.upkeep > 0 ? a.bank / a.upkeep : 999;
            const bDays = b.upkeep > 0 ? b.bank / b.upkeep : 999;
            return aDays - bDays;
          });

        if (atRiskTowns.length > 0) {
          lines.push('', `**Towns at Risk (< ${thresholdDays} days):**`);
          for (const t of atRiskTowns) {
            const daysLeft = t.upkeep > 0 ? Math.floor(t.bank / t.upkeep) : 999;
            lines.push(
              `• **${t.name}** — $${t.bank.toFixed(2)} bank, ` +
              `$${t.upkeep.toFixed(2)}/day upkeep, **${daysLeft} day${daysLeft === 1 ? '' : 's'}**`,
            );
          }
        } else {
          lines.push('', `No towns at risk within ${thresholdDays} days. ✅`);
        }
      }

      await interaction.editReply({
        embeds: [infoEmbed(`🏛️ ${name}`, lines.join('\n'))],
      });
    },
  });
}
