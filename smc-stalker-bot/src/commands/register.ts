/**
 * Slash command registry.
 *
 * Provides per-guild command deployment and runtime command lookup.
 */

import {
  REST,
  Routes,
  type RESTPostAPIApplicationCommandsJSONBody,
  type SlashCommandBuilder,
  type SlashCommandSubcommandsOnlyBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';

export interface CommandDefinition {
  data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

const commandRegistry = new Map<string, CommandDefinition>();

/**
 * Register a command definition. Call at startup for each command module.
 */
export function defineCommand(command: CommandDefinition): void {
  const name = command.data.name;
  if (commandRegistry.has(name)) {
    throw new Error(`Duplicate command registration: ${name}`);
  }
  commandRegistry.set(name, command);
}

/**
 * Look up a command by name. Returns undefined if not found.
 */
export function getCommand(name: string): CommandDefinition | undefined {
  return commandRegistry.get(name);
}

/**
 * Get all registered command JSON payloads for API registration.
 */
function getAllCommandJSONs(): RESTPostAPIApplicationCommandsJSONBody[] {
  const payloads: RESTPostAPIApplicationCommandsJSONBody[] = [];
  for (const cmd of commandRegistry.values()) {
    payloads.push(cmd.data.toJSON());
  }
  return payloads;
}

/**
 * Deploy all registered commands to a specific guild.
 * Uses per-guild registration for instant propagation (no global cache delay).
 */
export async function deployCommands(
  token: string,
  clientId: string,
  guildId: string,
): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(token);
  const commands = getAllCommandJSONs();

  await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
    body: commands,
  });
}
