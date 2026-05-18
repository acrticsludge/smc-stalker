/**
 * Paginated embed response helper.
 *
 * Splits a large collection of items across multiple embed pages
 * with button-based navigation (previous / next).
 */

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  type ButtonInteraction,
  type EmbedBuilder,
  type GuildTextBasedChannel,
  type Message,
} from 'discord.js';

const PREV_BUTTON_ID = 'page_prev';
const NEXT_BUTTON_ID = 'page_next';
const COLLECTOR_TIMEOUT_MS = 120_000;

export interface PageData {
  embeds: EmbedBuilder[];
}

/**
 * Send a paginated message with previous/next navigation buttons.
 *
 * @param channel - The channel to send to
 * @param pages - Array of page data (each page can have multiple embeds)
 * @param userId - The user who invoked the command (only they can navigate)
 */
export async function sendPaginated(
  channel: GuildTextBasedChannel,
  pages: PageData[],
  userId: string,
): Promise<Message | null> {
  if (pages.length === 0) {
    return null;
  }

  let currentPage = 0;

  const prevButton = new ButtonBuilder()
    .setCustomId(PREV_BUTTON_ID)
    .setLabel('◀')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);

  const nextButton = new ButtonBuilder()
    .setCustomId(NEXT_BUTTON_ID)
    .setLabel('▶')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(pages.length <= 1);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton);

  const sent = await channel.send({
    embeds: pages[currentPage]!.embeds,
    components: pages.length > 1 ? [row] : [],
  });

  if (pages.length <= 1) {
    return sent;
  }

  const collector = sent.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (buttonInteraction) => {
      void buttonInteraction.deferUpdate();
      return buttonInteraction.user.id === userId;
    },
    time: COLLECTOR_TIMEOUT_MS,
  });

  collector.on('collect', (buttonInteraction: ButtonInteraction) => {
    if (buttonInteraction.customId === PREV_BUTTON_ID && currentPage > 0) {
      currentPage--;
    } else if (buttonInteraction.customId === NEXT_BUTTON_ID && currentPage < pages.length - 1) {
      currentPage++;
    }

    prevButton.setDisabled(currentPage === 0);
    nextButton.setDisabled(currentPage === pages.length - 1);

    void sent.edit({
      embeds: pages[currentPage]!.embeds,
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton)],
    });
  });

  collector.on('end', () => {
    prevButton.setDisabled(true);
    nextButton.setDisabled(true);
    void sent
      .edit({
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, nextButton)],
      })
      .catch(() => {
        // Message might have been deleted — ignore
      });
  });

  return sent;
}
