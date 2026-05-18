/**
 * /upkeep town — View a town's full details with rich formatting.
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { Sql } from 'postgres';
import { defineCommand } from '../register.js';
import { createTownRepository } from '../../repositories/town.repository.js';
import { createNationRepository } from '../../repositories/nation.repository.js';
import { createTownSnapshotRepository } from '../../repositories/town-snapshot.repository.js';
import { infoEmbed, dangerEmbed } from '../../lib/embed-builder.js';
import { escapeMD, formatCurrency, sectioned, displayDays } from '../../lib/format.js';
import { formatDateLongGMT } from '../../lib/dates.js';

const PLAYER_HEAD = 'https://mc-heads.net/avatar';

export function registerUpkeepTownCommand(sql: Sql): void {
  const townRepo = createTownRepository(sql);
  const nationRepo = createNationRepository(sql);
  const snapshotRepo = createTownSnapshotRepository(sql);

  defineCommand({
    data: new SlashCommandBuilder()
      .setName('upkeep-town')
      .setDescription("View a town's full details")
      .addStringOption((opt) =>
        opt.setName('name').setDescription('Town name').setRequired(true).setAutocomplete(true),
      ),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      const name = interaction.options.getString('name', true);
      const town = await townRepo.findByName(name);

      if (!town) {
        await interaction.editReply({
          embeds: [dangerEmbed('Town Not Found', `No town named **${escapeMD(name)}** found.`)],
        });
        return;
      }

      let nationName = 'None';
      let nationColor: number | null = null;
      if (town.nation_id) {
        const nation = await nationRepo.findById(town.nation_id);
        if (nation) {
          nationName = nation.name;
          nationColor = nation.color;
        }
      }

      // Use nation color if available, else town's own color, else default
      const embedColor = nationColor ?? town.color ?? undefined;

      const rawDays =
        town.bank <= 0 ? -1 : (town.upkeep > 0 ? Math.floor(town.bank / town.upkeep) : 999);
      const daysUntilInsolvent = displayDays(rawDays);

      const daysDisplay =
        daysUntilInsolvent === -1
          ? '💀 Insolvent'
          : daysUntilInsolvent === 999
            ? '∞'
            : `${daysUntilInsolvent} day${daysUntilInsolvent === 1 ? '' : 's'}`;

      const latestSnapshot = await snapshotRepo.findLatestByTown(town.id);

      const residentDisplay =
        latestSnapshot?.resident_names.length === 1
          ? escapeMD(latestSnapshot.resident_names[0]!)
          : latestSnapshot && latestSnapshot.resident_names.length > 5
            ? `${latestSnapshot.resident_names.slice(0, 5).map(escapeMD).join(', ')} +${latestSnapshot.resident_names.length - 5} more`
            : latestSnapshot
              ? latestSnapshot.resident_names.map(escapeMD).join(', ')
              : 'Unknown';

      const statusIcon =
        latestSnapshot?.status === 'peaceful' ? '☮️' :
        latestSnapshot?.status === 'unpeaceful' ? '⚔️' :
        '❓';

      const embed = infoEmbed(
        `🏘️ ${escapeMD(town.name)}`,
        sectioned([
          {
            title: '📍 Location',
            fields: [
              `**Nation:** ${escapeMD(nationName)}`,
              `**Status:** ${statusIcon} ${latestSnapshot?.status ?? 'Unknown'}`,
              `**Founded:** ${town.founded ? formatDateLongGMT(town.founded) : 'Unknown'}`,
            ],
          },
          {
            title: '👥 Residents',
            fields: [
              `**Total:** ${town.residents}`,
              `**Names:** ${residentDisplay}`,
            ],
          },
          {
            title: '💰 Finances',
            fields: [
              `**Bank:** ${formatCurrency(town.bank)}`,
              `**Upkeep:** ${formatCurrency(town.upkeep)}/day`,
              `**Days Until Insolvent:** ${daysDisplay}`,
            ],
          },
          {
            title: '🏛️ Government',
            fields: [
              `**Mayor:** ${escapeMD(town.mayor)}`,
            ],
          },
        ]),
        embedColor,
      );

      // Player head thumbnail
      if (town.mayor) {
        embed.setThumbnail(`${PLAYER_HEAD}/${encodeURIComponent(town.mayor)}/100`);
      }

      embed.setFooter({ text: `Last seen: ${formatDateLongGMT(town.last_seen_at)}` });

      await interaction.editReply({ embeds: [embed] });
    },
  });
}
