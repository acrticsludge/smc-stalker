/**
 * /alerts — Unified view of all alert configurations and
 * tracked nations for the current guild.
 *
 * Displays each alert config as its own embed with pagination
 * for an elegant per-config overview.
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
import { createAlertConfigRepository } from '../../repositories/alert-config.repository.js';
import { createGuildConfigRepository } from '../../repositories/guild-config.repository.js';
import { getAuth } from '../../services/auth.service.js';
import { infoEmbed, dangerEmbed } from '../../lib/embed-builder.js';
import type { AlertConfigRow } from '../../types/database.js';

const DEFAULT_COLOR = 0x00aaff;
const COLLECTOR_TIMEOUT_MS = 120_000;

/**
 * Build a single rich embed for one alert config with serial number.
 */
function buildConfigEmbed(config: AlertConfigRow, index: number): EmbedBuilder {
  const idx = index + 1;
  const statusEmoji = config.enabled ? '✅' : '❌';
  const typeLabel = config.type.toUpperCase();
  const nationScope = config.nation_name
    ? `\n🌍 **Nation:** ${config.nation_name}`
    : config.type === 'friendly'
      ? `\n🌍 **Nations:** ${Object.keys(config.nation_pings).length > 0 ? Object.keys(config.nation_pings).join(', ') : 'Global friendly list'}`
      : '';

  const trackedNations = config.type === 'friendly' && Object.keys(config.nation_pings).length > 0
    ? Object.entries(config.nation_pings)
        .map(([nat, rid]) => rid ? `\`${nat}\` → <@&${rid}>` : `\`${nat}\``)
        .join('\n')
    : null;

  const timeInfo = config.schedule_times.length > 0
    ? `🕐 **Schedule:** ${config.schedule_times.join(', ')} GMT`
    : '🕐 **Schedule:** Immediate (no scheduled time)';

  const thresholdInfo = config.threshold_days
    ? `📊 **Threshold:** ≤${config.threshold_days}d of upkeep`
    : '';

  const cooldownInfo = `⏱ **Cooldown:** ${config.cooldown_min}min`;

  const lastAlert = config.last_alert_at
    ? `📨 **Last Alert:** <t:${Math.floor(new Date(config.last_alert_at).getTime() / 1000)}:R>`
    : '📨 **Last Alert:** Never';

  const description = [
    `**${statusEmoji} ${typeLabel}** → <#${config.channel_id}>${config.role_id ? ` | <@&${config.role_id}>` : ''}`,
    nationScope,
    '',
    timeInfo,
    thresholdInfo,
    cooldownInfo,
    lastAlert,
    trackedNations ? `\n**Tracked Nations:**\n${trackedNations}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return new EmbedBuilder()
    .setColor(DEFAULT_COLOR)
    .setTitle(`Alert Config #${idx}`)
    .setDescription(description)
    .setFooter({ text: `SMC Stalker Bot • ID: ${config.id.slice(0, 8)}…` })
    .setTimestamp();
}

export function registerAlertsViewCommand(sql: Sql): void {
  const alertRepo = createAlertConfigRepository(sql);
  const configRepo = createGuildConfigRepository(sql);

  defineCommand({
    data: new SlashCommandBuilder()
      .setName('alerts')
      .setDescription('View all alert configs and tracked nations for this guild'),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      const auth = getAuth(interaction);
      if (!auth?.authorized) {
        await interaction.editReply({
          embeds: [dangerEmbed('Access Denied', 'You are not authorized.')],
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

      const [configs, friendlyNations, enemyNations] = await Promise.all([
        alertRepo.findByGuildSorted(guildId),
        configRepo.getTyped<string[]>(guildId, 'friendly_nations'),
        configRepo.getTyped<string[]>(guildId, 'enemy_nations'),
      ]);

      // ── Build pages ─────────────────────────────────────
      const pages: EmbedBuilder[] = [];

      // Page 0: Summary overview
      const summaryLines: string[] = [];

      const authEnabled = await configRepo.getTyped<boolean>(guildId, 'auth_enabled');
      if (authEnabled === false) {
        summaryLines.push('🔓 **Auth:** Disabled — open access\n');
      }

      if (configs.length === 0) {
        summaryLines.push('🔔 **Alert Configs:** None configured');
      } else {
        const overview = configs.map((c, i) => {
          const idx = i + 1;
          const status = c.enabled ? '✅' : '❌';
          const channel = `<#${c.channel_id}>`;
          return `\`[${idx}]\` ${status} **${c.type.toUpperCase()}** → ${channel}`;
        });
        summaryLines.push(`🔔 **Alert Configs (${configs.length}):**\n${overview.join('\n')}`);
      }

      summaryLines.push('');
      if (friendlyNations && friendlyNations.length > 0) {
        summaryLines.push(
          `🤝 **Friendly Nations (global):** ${friendlyNations.map((n) => `\`${n}\``).join(', ')}`,
        );
      } else if (!configs.some((c) => c.type === 'friendly' && Object.keys(c.nation_pings).length > 0)) {
        summaryLines.push('🤝 **Friendly Nations:** None tracked');
      }

      if (enemyNations && enemyNations.length > 0) {
        summaryLines.push(
          `⚔️ **Enemy Nations:** ${enemyNations.map((n) => `\`${n}\``).join(', ')}`,
        );
      } else {
        summaryLines.push('⚔️ **Enemy Nations:** None tracked');
      }

      pages.push(
        infoEmbed('📋 Alert Overview', summaryLines.join('\n')),
      );

      // Pages 1..N: One embed per config
      for (let i = 0; i < configs.length; i++) {
        pages.push(buildConfigEmbed(configs[i]!, i));
      }

      // ── Send paginated response ─────────────────────────
      if (pages.length === 1) {
        await interaction.editReply({ embeds: [pages[0]!] });
        return;
      }

      let currentPage = 0;

      const prevButton = new ButtonBuilder()
        .setCustomId('alerts_prev')
        .setLabel('◀')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);

      const pageLabel = new ButtonBuilder()
        .setCustomId('alerts_label')
        .setLabel(`Page ${currentPage + 1} / ${pages.length}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true);

      const nextButton = new ButtonBuilder()
        .setCustomId('alerts_next')
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
            btnInteraction.customId !== 'alerts_label'
          );
        },
        time: COLLECTOR_TIMEOUT_MS,
      });

      collector.on('collect', (btnInteraction: ButtonInteraction) => {
        if (btnInteraction.customId === 'alerts_prev' && currentPage > 0) {
          currentPage--;
        } else if (btnInteraction.customId === 'alerts_next' && currentPage < pages.length - 1) {
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
