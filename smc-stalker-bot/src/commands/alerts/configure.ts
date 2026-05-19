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
                  .setDescription('Alert time in HH:MM (GMT). Omit for immediate alerts.')
                  .setRequired(false),
              )
              .addIntegerOption((opt) =>
                opt
                  .setName('threshold-days')
                  .setDescription('Alert when bank < N days of upkeep (default: 7)')
                  .setRequired(false),
              )
              .addStringOption((opt) =>
                opt
                  .setName('nation')
                  .setDescription('Only monitor towns in this specific nation (omit for all)')
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
              .setDescription('Add a friendly nation to a specific config')
              .addStringOption((opt) =>
                opt
                  .setName('nation')
                  .setDescription('Nation name')
                  .setRequired(true),
              )
              .addIntegerOption((opt) =>
                opt
                  .setName('config')
                  .setDescription('Config serial number from /alert-status (required if adding nations)')
                  .setRequired(false)
                  .setMinValue(1),
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
          .setDescription('Configure enemy nation tracking (global across all configs)')
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
      )
      .addSubcommand((sub) =>
        sub
          .setName('delete')
          .setDescription('Delete an alert config by its serial number (use /alert-status to find it)')
          .addIntegerOption((opt) =>
            opt
              .setName('id')
              .setDescription('Serial number from /alert-status')
              .setRequired(true)
              .setMinValue(1),
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

      // ── Standalone subcommands (no group) ────────────────
      if (subcommand === 'delete') {
        const position = interaction.options.getInteger('id', true);

        const deleted = await alertRepo.deleteByPosition(guildId, position);
        if (!deleted) {
          await interaction.editReply({
            embeds: [
              dangerEmbed(
                'Not Found',
                `Alert config **#${position}** not found. Use \`/alert-status\` to see your configs.`,
              ),
            ],
          });
          return;
        }

        await interaction.editReply({
          embeds: [
            successEmbed(
              'Alert Config Deleted',
              `Deleted config **#${position}** (\`${deleted.type}\` → <#${deleted.channel_id}>)${deleted.nation_name ? ` for **${deleted.nation_name}**` : ''}.`,
            ),
          ],
        });
        return;
      }

      // ── Subcommand groups ───────────────────────────────
      if (group === 'upkeep' && subcommand === 'create') {
        const channel = interaction.options.getChannel('channel', true);
        const thresholdDays =
          interaction.options.getInteger('threshold-days') ?? 7;
        const timeRaw = interaction.options.getString('time');
        const nation = interaction.options.getString('nation');

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

        const nationNote = nation ? ` for nation **${nation}**` : '';

        await alertRepo.create({
          guildId,
          type: 'upkeep',
          nationName: nation ?? null,
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
              `Alerts will be sent to <#${channel.id}>${scheduleNote}${nationNote} when a town has less than **${thresholdDays} days** of upkeep remaining.`,
            ),
          ],
        });
      } else if (group === 'friendly') {
        if (subcommand === 'add') {
          const nation = interaction.options.getString('nation', true);
          const role = interaction.options.getRole('role');
          const configPosition = interaction.options.getInteger('config');

          if (configPosition) {
            // ── Per-config nation scoping ─────────────
            const configs = await alertRepo.findByGuildSorted(guildId);
            const target = configs[configPosition - 1];
            if (!target) {
              await interaction.editReply({
                embeds: [
                  dangerEmbed(
                    'Config Not Found',
                    `Alert config **#${configPosition}** not found. Use \`/alert-status\` to see your configs.`,
                  ),
                ],
              });
              return;
            }
            if (target.type !== 'friendly') {
              await interaction.editReply({
                embeds: [
                  dangerEmbed(
                    'Wrong Config Type',
                    `Config **#${configPosition}** is type \`${target.type}\`, not \`friendly\`. Use a friendly-type config.`,
                  ),
                ],
              });
              return;
            }

            // Add nation to this config's nation_pings (scoped tracking)
            const currentPings = { ...target.nation_pings };
            currentPings[nation] = role?.id ?? null;
            await alertRepo.update(target.id, { nationPings: currentPings });

            const roleDesc = role ? ` with <@&${role.id}> pings` : '';
            await interaction.editReply({
              embeds: [
                successEmbed(
                  'Friendly Nation Added',
                  `**${nation}** is now tracked under config **#${configPosition}**${roleDesc}.`,
                ),
              ],
            });
          } else {
            // ── Legacy: add to global friendly list ──
            const existing = await configRepo.getTyped<string[]>(guildId, 'friendly_nations');
            const nations = existing ?? [];
            if (!nations.includes(nation)) {
              nations.push(nation);
            }
            await configRepo.set(guildId, 'friendly_nations', nations);

            // If a role was provided, store it as the per-nation ping on first matching config
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

            const roleDesc = role ? ` with <@&${role.id}> pings` : '';
            await interaction.editReply({
              embeds: [successEmbed('Friendly Nation Added', `**${nation}** is now tracked as friendly (global list)${roleDesc}.`)],
            });
          }
        } else if (subcommand === 'remove') {
          const nation = interaction.options.getString('nation', true);
          const existing = await configRepo.getTyped<string[]>(guildId, 'friendly_nations');
          const nations = (existing ?? []).filter((n) => n !== nation);
          await configRepo.set(guildId, 'friendly_nations', nations);

          // Also remove from all config's nation_pings
          const configs = await alertRepo.findByGuild(guildId);
          for (const config of configs) {
            const pings = config.nation_pings;
            if (nation in pings) {
              const newPings = { ...pings };
              delete newPings[nation];
              await alertRepo.update(config.id, { nationPings: newPings });
            }
          }

          await interaction.editReply({
            embeds: [successEmbed('Friendly Nation Removed', `**${nation}** removed from friendly list.`)],
          });
        } else if (subcommand === 'list') {
          // List both global and per-config nations
          const globalNations = await configRepo.getTyped<string[]>(guildId, 'friendly_nations');
          const configs = await alertRepo.findByGuildSorted(guildId);
          const perConfigNations = configs
            .filter((c) => c.type === 'friendly' && Object.keys(c.nation_pings).length > 0)
            .map((c) => {
              const idx = configs.indexOf(c) + 1;
              const nations = Object.entries(c.nation_pings)
                .filter(([_, rid]) => rid !== undefined)
                .map(([nat, rid]) => rid ? `${nat} → <@&${rid}>` : nat);
              return `  **#${idx}:** ${nations.join(', ')}`;
            });

          const lines: string[] = [];
          if (globalNations?.length) {
            lines.push(`**Global list:** ${globalNations.map((n) => `\`${n}\``).join(', ')}`);
          }
          if (perConfigNations.length) {
            lines.push(`**Per-config:**\n${perConfigNations.join('\n')}`);
          }
          if (lines.length === 0) {
            lines.push('No friendly nations configured.');
          }

          await interaction.editReply({
            embeds: [infoEmbed('Friendly Nations', lines.join('\n\n'))],
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
