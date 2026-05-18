/**
 * /upkeep nation — View a nation's upkeep overview.
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

export function registerUpkeepNationCommand(sql: Sql): void {
  const nationRepo = createNationRepository(sql);
  const townRepo = createTownRepository(sql);

  defineCommand({
    data: new SlashCommandBuilder()
      .setName('upkeep-nation')
      .setDescription('View a nation\'s upkeep overview')
      .addStringOption((opt) =>
        opt.setName('name').setDescription('Nation name').setRequired(true),
      ),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      const name = interaction.options.getString('name', true);

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
      const atRiskTowns = towns.filter((t) => t.upkeep > 0 && t.bank < t.upkeep * 7).length;

      const embed = infoEmbed(`🏛️ ${name}`, [
        `**Towns:** ${towns.length}`,
        `**Total Residents:** ${totalResidents}`,
        `**Total Bank:** $${totalBank.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        `**Total Upkeep:** $${totalUpkeep.toLocaleString(undefined, { minimumFractionDigits: 2 })}/day`,
        `**Average Bank/Town:** $${(totalBank / towns.length).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        `**Towns at Risk (< 7 days):** ${atRiskTowns}`,
        `**Last Seen:** <t:${Math.floor(new Date(nation.last_seen_at).getTime() / 1000)}:R>`,
      ].join('\n'));

      await interaction.editReply({ embeds: [embed] });
    },
  });
}
