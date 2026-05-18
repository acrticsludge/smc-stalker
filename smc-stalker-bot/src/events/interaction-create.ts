/**
 * Interaction create event handler.
 *
 * Receives all interactions and dispatches to the appropriate
 * command handler after authorization checks.
 */

import {
  type Interaction,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { Sql } from 'postgres';
import { createLogger } from '../lib/logger.js';
import { getCommand } from '../commands/register.js';
import { checkAuthorization } from '../services/auth.service.js';
import { dangerEmbed } from '../lib/embed-builder.js';

const logger = createLogger('interaction');

/**
 * Handle an incoming interaction.
 */
export async function handleInteraction(
  interaction: Interaction,
  sql: Sql,
): Promise<void> {
  if (!interaction.isChatInputCommand()) {
    return;
  }

  try {
    await executeCommand(interaction, sql);
  } catch (error) {
    logger.error(
      {
        command: interaction.commandName,
        user: interaction.user.id,
        guild: interaction.guildId,
        error: String(error),
      },
      'Unhandled command error',
    );

    const errorEmbed = dangerEmbed(
      'Command Error',
      'An unexpected error occurred. Please try again later.',
    );

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [errorEmbed] });
    } else {
      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  }
}

/**
 * Execute a validated command with authorization checks.
 */
async function executeCommand(
  interaction: ChatInputCommandInteraction,
  sql: Sql,
): Promise<void> {
  const command = getCommand(interaction.commandName);

  if (!command) {
    await interaction.reply({
      embeds: [
        dangerEmbed(
          'Unknown Command',
          `\`/${interaction.commandName}\` is not registered.`,
        ),
      ],
      ephemeral: true,
    });
    return;
  }

  // Authorization check
  const auth = await checkAuthorization(interaction, sql);

  if (!auth.authorized) {
    await interaction.reply({
      embeds: [dangerEmbed('Access Denied', auth.reason)],
      ephemeral: true,
    });
    return;
  }

  // Execute the command handler (commands should deferReply if they need time)
  await command.execute(interaction);
}
