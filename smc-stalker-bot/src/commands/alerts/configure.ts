/**
 * /alert configure — Set up alert config for a guild.
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { Sql } from 'postgres';
import { defineCommand } from '../register.js';
import { createAlertConfigRepository } from '../../repositories/alert-config.repository.js';
import { createGuildConfigRepository } from '../../repositories/guild-config.repository.js';
import { getAuth } from '../../services/auth.service.js';
import { infoEmbed, successEmbed, dangerEmbed } from '../../lib/embed-builder.js';

export function registerAlertConfigureCommand(sql: Sql): void {
  const alertRepo = createAlertConfigRepository(sql);
  const configRepo = createGuildConfigRepository(sql);

  defineCommand({
    data: new SlashCommandBuilder()
      .setName('alert-configure')
      .setDescription('Configure alerts for this guild (admin only)')
      .addSubcommandGroup((group) =>
        group
          .setName('upkeep')
          .setDescription('Configure upkeep alerts')
          .addSubcommand((sub) =>
            sub
              .setName('create')
              .setDescription('Create an upkeep alert config')
              .addChannelOption((opt) =>
                opt
                  .setName('channel')
                  .setDescription('Alert channel')
                  .setRequired(true),
              )
              .addStringOption((opt) =>
                opt
                  .setName('time')
                  .setDescription('Alert time in HH:MM (24h). Omit for immediate alerts.')
                  .setRequired(false),
              )
              .addIntegerOption((opt) =>
                opt
                  .setName('threshold-days')
                  .setDescription('Alert when bank < N days of upkeep (default: 7)')
                  .setRequired(false),
              ),
          ),
      )
      .addSubcommandGroup((group) =>
        group
          .setName('friendly')
          .setDescription('Configure friendly nation tracking')
          .addSubcommand((sub) =>
            sub
              .setName('add')
              .setDescription('Add a friendly nation (optional role ping)')
              .addStringOption((opt) =>
                opt
                  .setName('nation')
                  .setDescription('Nation name')
                  .setRequired(true),
              )
              .addRoleOption((opt) =>
                opt
                  .setName('role')
                  .setDescription('Role to ping when this nation has at-risk towns')
                  .setRequired(false),
              ),
          )
          .addSubcommand((sub) =>
            sub
              .setName('remove')
              .setDescription('Remove a friendly nation')
              .addStringOption((opt) =>
                opt
                  .setName('nation')
                  .setDescription('Nation name')
                  .setRequired(true),
              ),
          )
          .addSubcommand((sub) =>
            sub.setName('list').setDescription('List friendly nations'),
          ),
      )
      .addSubcommandGroup((group) =>
        group
          .setName('enemy')
          .setDescription('Configure enemy nation tracking')
          .addSubcommand((sub) =>
            sub
              .setName('add')
              .setDescription('Add an enemy nation')
              .addStringOption((opt) =>
                opt
                  .setName('nation')
                  .setDescription('Nation name')
                  .setRequired(true),
              ),
          )
          .addSubcommand((sub) =>
            sub
              .setName('remove')
              .setDescription('Remove an enemy nation')
              .addStringOption((opt) =>
                opt
                  .setName('nation')
                  .setDescription('Nation name')
                  .setRequired(true),
              ),
          )
          .addSubcommand((sub) =>
            sub.setName('list').setDescription('List enemy nations'),
          ),
      ),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      const auth = getAuth(interaction);
      if (!auth?.isGuildAdmin) {
        await interaction.editReply({
          embeds: [
            dangerEmbed(
              'Access Denied',
              'Only guild admins can configure alerts.',
            ),
          ],
        });
        return;
      }

      const guildId = interaction.guildId;
      if (!guildId) {
        await interaction.editReply({
          embeds: [dangerEmbed('Error', 'This command must be used in a server.')],
        });
        return;
      }

      const group = interaction.options.getSubcommandGroup();
      const subcommand = interaction.options.getSubcommand();

      if (group === 'upkeep' && subcommand === 'create') {
        const channel = interaction.options.getChannel('channel', true);
        const thresholdDays =
          interaction.options.getInteger('threshold-days') ?? 7;
        const timeRaw = interaction.options.getString('time');

        const scheduleTimes: string[] = [];
        let scheduleNote = '';
        if (timeRaw) {
          // Validate HH:MM format
          if (!/^\d{2}:\d{2}$/.test(timeRaw)) {
            await interaction.editReply({
              embeds: [
                dangerEmbed('Invalid Time', 'Time must be in **HH:MM** format, e.g. `20:00` for 8 PM.'),
              ],
            });
            return;
          }
          scheduleTimes.push(timeRaw);
          scheduleNote = ` at **${timeRaw}**`;
        }

        await alertRepo.create({
          guildId,
          type: 'upkeep',
          nationName: null,
          channelId: channel.id,
          roleId: null,
          scheduleTimes,
          cooldownMin: 60,
          thresholdDays,
        });

        await interaction.editReply({
          embeds: [
            successEmbed(
              'Upkeep Alert Created',
              `Alerts will be sent to <#${channel.id}>${scheduleNote} when a town has less than **${thresholdDays} days** of upkeep remaining.`,
            ),
          ],
        });
      } else       if (group === 'friendly') {
        if (subcommand === 'add') {
          const nation = interaction.options.getString('nation', true);
          const role = interaction.options.getRole('role');

          // Add nation to friendly list
          const existing = await configRepo.getTyped<string[]>(guildId, 'friendly_nations');
          const nations = existing ?? [];
          if (!nations.includes(nation)) {
            nations.push(nation);
          }
          await configRepo.set(guildId, 'friendly_nations', nations);

          // If a role was provided, store it as the per-nation ping
          if (role) {
            const configs = await alertRepo.findByGuild(guildId);
            const target = configs.find(
              (c) => c.type === 'upkeep' || c.type === 'friendly',
            );
            if (target) {
              const currentPings = target.nation_pings;
              currentPings[nation] = role.id;
              await alertRepo.update(target.id, { nationPings: currentPings });
            }
          }

          const roleDesc = role
            ? ` with <@&${role.id}> pings`
            : '';
          await interaction.editReply({
            embeds: [successEmbed('Friendly Nation Added', `**${nation}** is now tracked as friendly${roleDesc}.`)],
          });
        } else if (subcommand === 'remove') {
          const nation = interaction.options.getString('nation', true);
          const existing = await configRepo.getTyped<string[]>(guildId, 'friendly_nations');
          const nations = (existing ?? []).filter((n) => n !== nation);
          await configRepo.set(guildId, 'friendly_nations', nations);

          await interaction.editReply({
            embeds: [successEmbed('Friendly Nation Removed', `**${nation}** removed from friendly list.`)],
          });
        } else if (subcommand === 'list') {
          const nations = await configRepo.getTyped<string[]>(guildId, 'friendly_nations');
          const list = nations?.length
            ? nations.map((n) => `• ${n}`).join('\n')
            : 'No friendly nations configured.';

          await interaction.editReply({
            embeds: [infoEmbed('Friendly Nations', list)],
          });
        }
      } else if (group === 'enemy') {
        if (subcommand === 'add') {
          const nation = interaction.options.getString('nation', true);
          const existing = await configRepo.getTyped<string[]>(guildId, 'enemy_nations');
          const nations = existing ?? [];
          if (!nations.includes(nation)) {
            nations.push(nation);
          }
          await configRepo.set(guildId, 'enemy_nations', nations);

          await interaction.editReply({
            embeds: [successEmbed('Enemy Nation Added', `**${nation}** is now tracked as enemy.`)],
          });
        } else if (subcommand === 'remove') {
          const nation = interaction.options.getString('nation', true);
          const existing = await configRepo.getTyped<string[]>(guildId, 'enemy_nations');
          const nations = (existing ?? []).filter((n) => n !== nation);
          await configRepo.set(guildId, 'enemy_nations', nations);

          await interaction.editReply({
            embeds: [successEmbed('Enemy Nation Removed', `**${nation}** removed from enemy list.`)],
          });
        } else if (subcommand === 'list') {
          const nations = await configRepo.getTyped<string[]>(guildId, 'enemy_nations');
          const list = nations?.length
            ? nations.map((n) => `• ${n}`).join('\n')
            : 'No enemy nations configured.';

          await interaction.editReply({
            embeds: [infoEmbed('Enemy Nations', list)],
          });
        }
      }
    },
  });
}
