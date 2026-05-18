/**
 * Paginated embed response helper.
 *
 * Splits a large collection across multiple embed pages with
 * button-based navigation. Shows "Page X / Y" in the embed footer.
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
 * Send a paginated message with previous/next buttons.
 * Automatically appends "Page X / Y" to the footer of each embed.
 */
export async function sendPaginated(
  channel: GuildTextBasedChannel,
  pages: PageData[],
  userId: string,
): Promise<Message | null> {
  if (pages.length === 0) return null;

  // Add page numbering to each page's embeds
  for (let i = 0; i < pages.length; i++) {
    for (const embed of pages[i]!.embeds) {
      embed.setFooter({ text: `Page ${i + 1} / ${pages.length}` });
    }
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

  const pageLabel = new ButtonBuilder()
    .setCustomId('page_label')
    .setLabel(`Page ${currentPage + 1} / ${pages.length}`)
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    prevButton,
    pageLabel,
    nextButton,
  );

  const sent = await channel.send({
    embeds: pages[currentPage]!.embeds,
    components: pages.length > 1 ? [row] : [],
  });

  if (pages.length <= 1) return sent;

  const collector = sent.createMessageComponentCollector({
    componentType: ComponentType.Button,
    filter: (btnInteraction) => {
      void btnInteraction.deferUpdate();
      return btnInteraction.user.id === userId && btnInteraction.customId !== 'page_label';
    },
    time: COLLECTOR_TIMEOUT_MS,
  });

  collector.on('collect', (btnInteraction: ButtonInteraction) => {
    if (btnInteraction.customId === PREV_BUTTON_ID && currentPage > 0) {
      currentPage--;
    } else if (btnInteraction.customId === NEXT_BUTTON_ID && currentPage < pages.length - 1) {
      currentPage++;
    }

    prevButton.setDisabled(currentPage === 0);
    nextButton.setDisabled(currentPage === pages.length - 1);
    pageLabel.setLabel(`Page ${currentPage + 1} / ${pages.length}`);

    void sent.edit({
      embeds: pages[currentPage]!.embeds,
      components: [new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, pageLabel, nextButton)],
    });
  });

  collector.on('end', () => {
    prevButton.setDisabled(true);
    nextButton.setDisabled(true);
    void sent
      .edit({
        components: [new ActionRowBuilder<ButtonBuilder>().addComponents(prevButton, pageLabel, nextButton)],
      })
      .catch(() => { /* message deleted, ignore */ });
  });

  return sent;
}
