/**
 * /admin toggle-auth — Superadmin-only command to enable/disable
 * authorization checks for a guild.
 *
 * When auth is OFF, anyone in that guild can use any command
 * without whitelist, user, or role checks.
 */

import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { Sql } from 'postgres';
import { defineCommand } from '../register.js';
import { createGuildConfigRepository } from '../../repositories/guild-config.repository.js';
import { getAuth } from '../../services/auth.service.js';
import { successEmbed, dangerEmbed } from '../../lib/embed-builder.js';

export function registerToggleAuthCommand(sql: Sql): void {
  const configRepo = createGuildConfigRepository(sql);

  defineCommand({
    data: new SlashCommandBuilder()
      .setName('admin-toggle-auth')
      .setDescription('Enable or disable auth checks for a guild (superadmin only)')
      .addStringOption((opt) =>
        opt.setName('guild-id').setDescription('Discord guild ID').setRequired(true),
      )
      .addStringOption((opt) =>
        opt
          .setName('mode')
          .setDescription('on = auth enforced, off = open access')
          .setRequired(true)
          .addChoices(
            { name: 'on — Auth enforced (default)', value: 'on' },
            { name: 'off — Open access (anyone can use commands)', value: 'off' },
          ),
      ),
    async execute(interaction: ChatInputCommandInteraction): Promise<void> {
      const auth = getAuth(interaction);
      if (!auth?.isSuperAdmin) {
        await interaction.editReply({
          embeds: [
            dangerEmbed(
              'Access Denied',
              'Only the superadmin can toggle auth settings.',
            ),
          ],
        });
        return;
      }

      const guildId = interaction.options.getString('guild-id', true);
      const mode = interaction.options.getString('mode', true);

      const authEnabled = mode === 'on';
      await configRepo.set(guildId, 'auth_enabled', authEnabled);

      const status = authEnabled ? '✅ **enforced**' : '❌ **disabled** (open access)';

      await interaction.editReply({
        embeds: [
          successEmbed(
            'Auth Toggled',
            `Authorization for guild \`${guildId}\` is now ${status}.`,
          ),
        ],
      });
    },
  });
}
