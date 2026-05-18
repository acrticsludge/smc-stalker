/**
 * /player <name> — Look up a Minecraft player's info: town, nation, head.
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  EmbedBuilder,
} from 'discord.js';
import type { Sql } from 'postgres';
import { defineCommand } from './register.js';
import { createTownRepository } from '../repositories/town.repository.js';
import { createNationRepository } from '../repositories/nation.repository.js';
import { createTownSnapshotRepository } from '../repositories/town-snapshot.repository.js';
import { dangerEmbed } from '../lib/embed-builder.js';
import { escapeMD, sectioned } from '../lib/format.js';

const PLAYER_HEAD = 'https://mc-heads.net/avatar';

export function registerPlayerCommand(sql: Sql): void {
  const townRepo = createTownRepository(sql);
  const nationRepo = createNationRepository(sql);
  const snapshotRepo = createTownSnapshotRepository(sql);

  defineCommand({
    data: new SlashCommandBuilder()
      .setName('player')
      .setDescription('Look up a player by name (town, nation, head)')
      .addStringOption((opt) =>
        opt.setName('name').setDescription('Player / Minecraft username').setRequired(true),
      ),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      const name = interaction.options.getString('name', true);
      const lowerName = name.toLowerCase();

      // Search all towns for a matching mayor or resident
      const allTowns = await townRepo.findAll();

      let match: { townName: string; nationName: string; color: number | null } | null = null;

      for (const town of allTowns) {
        // Check mayor
        if (town.mayor.toLowerCase() === lowerName) {
          let nationName = 'None';
          let color: number | null = town.color;
          if (town.nation_id) {
            const nation = await nationRepo.findById(town.nation_id);
            if (nation) {
              nationName = nation.name;
              color = nation.color ?? town.color;
            }
          }
          match = { townName: town.name, nationName, color };
          break;
        }

        // Check residents list in latest snapshot
        const snapshot = await snapshotRepo.findLatestByTown(town.id);
        if (snapshot?.resident_names) {
          const isResident = snapshot.resident_names.some(
            (rn) => rn.toLowerCase() === lowerName,
          );
          if (isResident) {
            let nationName = 'None';
            let color: number | null = town.color;
            if (town.nation_id) {
              const nation = await nationRepo.findById(town.nation_id);
              if (nation) {
                nationName = nation.name;
                color = nation.color ?? town.color;
              }
            }
            match = { townName: town.name, nationName, color };
            break;
          }
        }
      }

      if (!match) {
        await interaction.editReply({
          embeds: [dangerEmbed('Player Not Found', `No player named **${escapeMD(name)}** found in any town.`)],
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(match.color ?? 0x00aaff)
        .setTitle(escapeMD(name))
        .setThumbnail(`${PLAYER_HEAD}/${encodeURIComponent(name)}/100`)
        .setDescription(
          sectioned([
            {
              fields: [
                `**Town:** ${escapeMD(match.townName)}`,
                `**Nation:** ${escapeMD(match.nationName)}`,
              ],
            },
          ]),
        )
        .setFooter({ text: 'SMC Stalker Bot' })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    },
  });
}
