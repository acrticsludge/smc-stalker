/**
 * /upkeep town — View a town's upkeep details.
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { Sql } from 'postgres';
import { defineCommand } from '../register.js';
import { createTownRepository } from '../../repositories/town.repository.js';
import { createNationRepository } from '../../repositories/nation.repository.js';
import { infoEmbed, dangerEmbed } from '../../lib/embed-builder.js';

export function registerUpkeepTownCommand(sql: Sql): void {
  const townRepo = createTownRepository(sql);
  const nationRepo = createNationRepository(sql);

  defineCommand({
    data: new SlashCommandBuilder()
      .setName('upkeep-town')
      .setDescription('View a town\'s upkeep details')
      .addStringOption((opt) =>
        opt.setName('name').setDescription('Town name').setRequired(true).setAutocomplete(true),
      ),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      const name = interaction.options.getString('name', true);

      const town = await townRepo.findByName(name);
      if (!town) {
        await interaction.editReply({
          embeds: [dangerEmbed('Town Not Found', `No town named **${name}** found.`)],
        });
        return;
      }

      let nationName = 'None';
      if (town.nation_id) {
        const nation = await nationRepo.findById(town.nation_id);
        if (nation) {
          nationName = nation.name;
        }
      }

      const daysUntilInsolvent =
        town.upkeep > 0 ? Math.floor(town.bank / town.upkeep) : 999;

      const embed = infoEmbed(`🏘️ ${town.name}`, [
        `**Mayor:** ${town.mayor}`,
        `**Residents:** ${town.residents}`,
        `**Nation:** ${nationName}`,
        `**Founded:** ${town.founded ?? 'Unknown'}`,
        `**Bank:** $${town.bank.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
        `**Upkeep:** $${town.upkeep.toLocaleString(undefined, { minimumFractionDigits: 2 })}/day`,
        `**Days Until Insolvent:** ${daysUntilInsolvent}`,
        `**Last Seen:** <t:${Math.floor(new Date(town.last_seen_at).getTime() / 1000)}:R>`,
      ].join('\n'));

      embed.setFooter({ text: `Town ID: ${town.id}` });

      await interaction.editReply({ embeds: [embed] });
    },
  });
}
