/**
 * /guilds — Superadmin-only guild listing with detailed per-guild info.
 *
 * Shows all guilds the bot is in, with admins, alert counts, and stats.
 * Paginated when there are many guilds.
 */

import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
} from 'discord.js';
import type { Sql } from 'postgres';
import { defineCommand } from '../register.js';
import { createGuildRepository } from '../../repositories/guild.repository.js';
import { createGuildUserRepository } from '../../repositories/guild-user.repository.js';
import { createGuildRoleRepository } from '../../repositories/guild-role.repository.js';
import { createAlertConfigRepository } from '../../repositories/alert-config.repository.js';
import { createGuildConfigRepository } from '../../repositories/guild-config.repository.js';
import { getAuth } from '../../services/auth.service.js';
import { dangerEmbed } from '../../lib/embed-builder.js';
import { formatDateLongGMT } from '../../lib/dates.js';

const DEFAULT_COLOR = 0x00aaff;
const COLLECTOR_TIMEOUT_MS = 120_000;

/**
 * Build a single embed for one guild's details.
 */
function buildGuildEmbed(
  guild: { id: string; name: string; is_whitelisted: boolean; created_at: string },
  admins: { discord_id: string }[],
  userCount: number,
  roleCount: number,
  alertCount: number,
  alertBreakdown: string,
  configCount: number,
  index: number,
  total: number,
): EmbedBuilder {
  const whitelistStatus = guild.is_whitelisted ? '✅ Yes' : '❌ No';
  const adminList =
    admins.length > 0
      ? admins.map((a) => `<@${a.discord_id}>`).join(', ')
      : 'None';

  const description = [
    `**ID:** \`${guild.id}\``,
    `**Whitelisted:** ${whitelistStatus}`,
    `**Created:** ${formatDateLongGMT(guild.created_at)}`,
    '',
    `**👑 Admins (${admins.length}):** ${adminList}`,
    `**👤 Authorized Users:** ${userCount}`,
    `**🔑 Authorized Roles:** ${roleCount}`,
    `**⚙️ Config Keys:** ${configCount}`,
    '',
    `**🔔 Alert Configs (${alertCount}):**`,
    alertBreakdown,
  ].join('\n');

  return new EmbedBuilder()
    .setColor(DEFAULT_COLOR)
    .setTitle(`${index + 1}. ${guild.name}`)
    .setDescription(description)
    .setFooter({ text: `SMC Stalker Bot • Guild ${index + 1} of ${total}` })
    .setTimestamp();
}

export function registerGuildsCommand(sql: Sql): void {
  const guildRepo = createGuildRepository(sql);
  const userRepo = createGuildUserRepository(sql);
  const roleRepo = createGuildRoleRepository(sql);
  const alertRepo = createAlertConfigRepository(sql);
  const configRepo = createGuildConfigRepository(sql);

  defineCommand({
    data: new SlashCommandBuilder()
      .setName('guilds')
      .setDescription('List all guilds with detailed info (superadmin only)'),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      const auth = getAuth(interaction);
      if (!auth?.isSuperAdmin) {
        await interaction.editReply({
          embeds: [
            dangerEmbed('Access Denied', 'Only the superadmin can list guilds.'),
          ],
        });
        return;
      }

      const guilds = await guildRepo.findAll();

      if (guilds.length === 0) {
        await interaction.editReply({
          embeds: [
            dangerEmbed('No Guilds', 'The bot is not in any guilds yet.'),
          ],
        });
        return;
      }

      // Build all pages
      const pages: EmbedBuilder[] = [];

      for (let i = 0; i < guilds.length; i++) {
        const guild = guilds[i]!;

        const [users, roles, alerts, configs] = await Promise.all([
          userRepo.findByGuild(guild.id),
          roleRepo.findByGuild(guild.id),
          alertRepo.findByGuildSorted(guild.id),
          configRepo.getAll(guild.id),
        ]);

        const admins = users.filter((u) => u.role === 'admin');
        const userCount = users.filter((u) => u.role === 'user').length;

        // Alert breakdown by type
        const upkeepCount = alerts.filter((a) => a.type === 'upkeep').length;
        const friendlyCount = alerts.filter((a) => a.type === 'friendly').length;
        const enemyCount = alerts.filter((a) => a.type === 'enemy').length;
        const breakdownParts: string[] = [];
        if (upkeepCount > 0) breakdownParts.push(`Upkeep: ${upkeepCount}`);
        if (friendlyCount > 0) breakdownParts.push(`Friendly: ${friendlyCount}`);
        if (enemyCount > 0) breakdownParts.push(`Enemy: ${enemyCount}`);
        const alertBreakdown =
          breakdownParts.length > 0
            ? breakdownParts.join(' | ')
            : 'None configured';

        pages.push(
          buildGuildEmbed(
            guild,
            admins,
            userCount,
            roles.length,
            alerts.length,
            alertBreakdown,
            configs.length,
            i,
            guilds.length,
          ),
        );
      }

      // ── Send paginated response ─────────────────────────
      if (pages.length === 1) {
        await interaction.editReply({ embeds: [pages[0]!] });
        return;
      }

      let currentPage = 0;

      const prevButton = new ButtonBuilder()
        .setCustomId('guilds_prev')
        .setLabel('◀')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);

      const pageLabel = new ButtonBuilder()
        .setCustomId('guilds_label')
        .setLabel(`Page ${currentPage + 1} / ${pages.length}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);

      const nextButton = new ButtonBuilder()
        .setCustomId('guilds_next')
        .setLabel('▶')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(false);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        prevButton,
        pageLabel,
        nextButton,
      );

      const sent = await interaction.editReply({
        embeds: [pages[currentPage]!],
        components: [row],
      });

      const collector = sent.createMessageComponentCollector({
        componentType: ComponentType.Button,
        filter: (btnInteraction: ButtonInteraction) => {
          void btnInteraction.deferUpdate();
          return (
            btnInteraction.user.id === interaction.user.id &&
            btnInteraction.customId !== 'guilds_label'
          );
        },
        time: COLLECTOR_TIMEOUT_MS,
      });

      collector.on('collect', (btnInteraction: ButtonInteraction) => {
        if (btnInteraction.customId === 'guilds_prev' && currentPage > 0) {
          currentPage--;
        } else if (btnInteraction.customId === 'guilds_next' && currentPage < pages.length - 1) {
          currentPage++;
        }

        prevButton.setDisabled(currentPage === 0);
        nextButton.setDisabled(currentPage === pages.length - 1);
        pageLabel.setLabel(`Page ${currentPage + 1} / ${pages.length}`);

        void sent.edit({
          embeds: [pages[currentPage]!],
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, pageLabel, nextButton),
          ],
        });
      });

      collector.on('end', () => {
        prevButton.setDisabled(true);
        nextButton.setDisabled(true);
        void sent
          .edit({
            components: [
              new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, pageLabel, nextButton),
            ],
          })
          .catch(() => { /* message deleted, ignore */ });
      });
    },
  });
}
