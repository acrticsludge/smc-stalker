/**
 * /upkeep-nation — View a nation's overview with colours and formatting.
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
import { escapeMD, formatCurrency, sectioned } from '../../lib/format.js';
import { formatDateLongGMT } from '../../lib/dates.js';

export function registerUpkeepNationCommand(sql: Sql): void {
  const nationRepo = createNationRepository(sql);
  const townRepo = createTownRepository(sql);

  defineCommand({
    data: new SlashCommandBuilder()
      .setName('upkeep-nation')
      .setDescription("View a nation's overview and at-risk towns")
      .addStringOption((opt) =>
        opt.setName('name').setDescription('Nation name').setRequired(true),
      )
      .addIntegerOption((opt) =>
        opt
          .setName('days')
          .setDescription('Show at-risk towns within N days (default: summary)')
          .setRequired(false)
          .setMinValue(1),
      ),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      const name = interaction.options.getString('name', true);
      const thresholdDays = interaction.options.getInteger('days');

      const nation = await nationRepo.findByName(name);
      if (!nation) {
        await interaction.editReply({
          embeds: [dangerEmbed('Nation Not Found', `No nation named **${escapeMD(name)}** found.`)],
        });
        return;
      }

      const towns = await townRepo.findByNation(nation.id);
      if (towns.length === 0) {
        await interaction.editReply({
          embeds: [infoEmbed(`🏛️ ${escapeMD(name)}`, 'This nation has no towns.', nation.color ?? undefined)],
        });
        return;
      }

      const totalBank = towns.reduce((s, t) => s + t.bank, 0);
      const totalUpkeep = towns.reduce((s, t) => s + t.upkeep, 0);
      const totalResidents = towns.reduce((s, t) => s + t.residents, 0);
      const atRiskCount = towns.filter((t) => t.upkeep > 0 && t.bank < t.upkeep * 7).length;

      const sections: { title?: string; fields: string[] }[] = [
        {
          title: '📊 Overview',
          fields: [
            `**Towns:** ${towns.length}`,
            `**Total Residents:** ${totalResidents.toLocaleString()}`,
            `**Total Upkeep:** ${formatCurrency(totalUpkeep)}/day`,
            `**Total Bank:** ${formatCurrency(totalBank)}`,
          ],
        },
        {
          title: '📈 Averages',
          fields: [
            `**Avg Bank/Town:** ${formatCurrency(totalBank / towns.length)}`,
            `**Avg Upkeep/Town:** ${formatCurrency(totalUpkeep / towns.length)}/day`,
          ],
        },
        {
          fields: [
            `**At Risk (< 7 days):** ${atRiskCount}`,
            `**Last Seen:** ${formatDateLongGMT(nation.last_seen_at)}`,
          ],
        },
      ];

      if (thresholdDays) {
        const atRiskTowns = towns
          .filter((t) => t.upkeep > 0 && t.bank < t.upkeep * thresholdDays)
          .sort((a, b) => {
            const aD = a.upkeep > 0 ? a.bank / a.upkeep : 999;
            const bD = b.upkeep > 0 ? b.bank / b.upkeep : 999;
            return aD - bD;
          });

        if (atRiskTowns.length > 0) {
          const riskLines = atRiskTowns.map((t) => {
            const daysLeft = t.bank <= 0 ? -1 : (t.upkeep > 0 ? Math.floor(t.bank / t.upkeep) : 999);
            const d = daysLeft === -1 ? '💀 insolvent' : `${daysLeft} day${daysLeft === 1 ? '' : 's'}`;
            return `• **${escapeMD(t.name)}** — ${formatCurrency(t.bank)} bank, ${formatCurrency(t.upkeep)}/day, **${d}**`;
          });
          sections.push({
            title: `⚠️ At Risk (< ${thresholdDays} days)`,
            fields: riskLines,
          });
        } else {
          sections.push({
            fields: [`No towns at risk within ${thresholdDays} days. ✅`],
          });
        }
      }

      const embed = infoEmbed(
        `🏛️ ${escapeMD(nation.name)}`,
        sectioned(sections),
        nation.color ?? undefined,
      );

      await interaction.editReply({ embeds: [embed] });
    },
  });
}
