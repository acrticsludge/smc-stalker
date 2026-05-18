/**
 * Discord-specific types used across commands and event handlers.
 */

import type {
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  AutocompleteInteraction,
  MessageContextMenuCommandInteraction,
  UserContextMenuCommandInteraction,
} from 'discord.js';

/** A registered slash command definition */
export interface CommandDefinition {
  data:
    | SlashCommandBuilder
    | SlashCommandSubcommandsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void> | void;
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void> | void;
}

/** Context menu command definition */
export interface ContextMenuCommandDefinition {
  data:
    | MessageContextMenuCommandInteraction
    | UserContextMenuCommandInteraction;
  execute: (interaction: MessageContextMenuCommandInteraction | UserContextMenuCommandInteraction) => Promise<void> | void;
}

/** Guild-specific command collection (keyed by guild ID) */
export type GuildCommandMap = Map<string, Map<string, CommandDefinition>>;

/** Authorization context for a command invocation */
export interface AuthContext {
  isSuperAdmin: boolean;
  isGuildWhitelisted: boolean;
  isGuildAdmin: boolean;
  isAuthorizedUser: boolean;
  isAuthorizedRole: boolean;
}
