/**
 * Interaction create event handler.
 *
 * Handles:
 *  - Slash commands (with auth check)
 *  - Button interactions (approve/deny access requests)
 */

import {
  type Interaction,
  type ChatInputCommandInteraction,
  type ButtonInteraction,
} from 'discord.js';
import type { Sql } from 'postgres';
import { createLogger } from '../lib/logger.js';
import { getCommand } from '../commands/register.js';
import { checkAuthorization } from '../services/auth.service.js';
import { createAccessRequestRepository } from '../repositories/access-request.repository.js';
import { createGuildUserRepository } from '../repositories/guild-user.repository.js';
import { SUPERADMIN_ID } from '../config/constants.js';
import { successEmbed, dangerEmbed } from '../lib/embed-builder.js';

const logger = createLogger('interaction');
let discordClient: import('discord.js').Client | null = null;

export function setInteractionClient(client: import('discord.js').Client): void {
  discordClient = client;
}

/**
 * Handle an incoming interaction.
 */
export async function handleInteraction(
  interaction: Interaction,
  sql: Sql,
): Promise<void> {
  if (interaction.isChatInputCommand()) {
    await handleCommand(interaction, sql);
  } else if (interaction.isButton()) {
    await handleButton(interaction, sql);
  }
}

/**
 * Handle a slash command.
 */
async function handleCommand(
  interaction: ChatInputCommandInteraction,
  sql: Sql,
): Promise<void> {
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
      await interaction.reply({ embeds: [errorEmbed], flags: 64 });
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
      flags: 64,
    });
    return;
  }

  // Authorization check
  const auth = await checkAuthorization(interaction, sql);

  if (!auth.authorized) {
    await interaction.reply({
      embeds: [dangerEmbed('Access Denied', auth.reason)],
      flags: 64,
    });
    return;
  }

  await interaction.deferReply();
  await command.execute(interaction);
}

/**
 * Handle a button interaction (approve/deny access requests).
 */
async function handleButton(
  interaction: ButtonInteraction,
  sql: Sql,
): Promise<void> {
  // Only the superadmin can use these buttons
  if (interaction.user.id !== SUPERADMIN_ID) {
    await interaction.reply({
      embeds: [dangerEmbed('Access Denied', 'Only the superadmin can review access requests.')],
      flags: 64,
    });
    return;
  }

  const customId = interaction.customId;

  // Parse: approve_access_<uuid> or deny_access_<uuid>
  const approveMatch = /^approve_access_(.+)$/.exec(customId);
  const denyMatch = /^deny_access_(.+)$/.exec(customId);
  const requestId = approveMatch?.[1] ?? denyMatch?.[1];

  if (!requestId) {
    await interaction.reply({
      embeds: [dangerEmbed('Error', 'Unknown button interaction.')],
      flags: 64,
    });
    return;
  }

  const accessRepo = createAccessRequestRepository(sql);
  const userRepo = createGuildUserRepository(sql);
  const request = await accessRepo.findById(requestId);

  if (request?.status !== 'pending') {
    await interaction.reply({
      embeds: [dangerEmbed('Already Reviewed', 'This request has already been processed.')],
      flags: 64,
    });
    return;
  }

  const isApprove = approveMatch !== null;

  if (isApprove) {
    // Create guild user entry
    await userRepo.add(request.guild_id, request.user_id, 'user');
    await accessRepo.approve(request.id);

    // DM the user confirmation
    if (discordClient) {
      try {
        const user = await discordClient.users.fetch(request.user_id);
        await user.send({
          embeds: [
            successEmbed(
              '✅ Access Approved',
              `Your request to use SMC Stalker Bot in guild \`${request.guild_id}\` has been **approved**. You can now use upkeep commands there.`,
            ),
          ],
        });
      } catch {
        logger.warn({ userId: request.user_id }, 'Failed to DM user about approval');
      }
    }

    await interaction.update({
      embeds: [
        successEmbed(
          '✅ Approved',
          `Access approved for **${request.user_name}** (\`${request.user_id}\`) in guild \`${request.guild_id}\`.`,
        ),
      ],
      components: [],
    });
  } else {
    await accessRepo.deny(request.id);

    // DM the user denial
    if (discordClient) {
      try {
        const user = await discordClient.users.fetch(request.user_id);
        await user.send({
          embeds: [
            dangerEmbed(
              '❌ Access Denied',
              `Your request to use SMC Stalker Bot in guild \`${request.guild_id}\` has been **denied**.`,
            ),
          ],
        });
      } catch {
        logger.warn({ userId: request.user_id }, 'Failed to DM user about denial');
      }
    }

    await interaction.update({
      embeds: [
        dangerEmbed(
          '❌ Denied',
          `Access denied for **${request.user_name}** (\`${request.user_id}\`) in guild \`${request.guild_id}\`.`,
        ),
      ],
      components: [],
    });
  }
}
