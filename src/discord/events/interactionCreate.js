import { MessageFlags } from 'discord.js';
import { configManager } from '../../config/configManager.js';
import { serverManager } from '../../services/serverManager.js';
import { canUseButton } from '../utils/permissions.js';

import * as setupCommand from '../commands/setup.js';
import * as configCommand from '../commands/config.js';


/**
 * Registry mapping command names to their respective module handlers.
 * @type {Record<string, { execute: (interaction: Interaction) => Promise<void> }>}
 */
const commands = {
    setup: setupCommand,
    config: configCommand
};


/**
 * Central router for incoming Discord interaction events (`interactionCreate`).
 * Directs slash commands to registered command modules and routes UI button clicks
 * to `serverManager` actions after validating maintenance mode and role permissions.
 *
 * @param {Interaction} interaction - The raw Discord interaction payload.
 * @returns {Promise<void>} Resolves when interaction routing, validation, and response execution complete.
 * @throws {Error} Logs errors encountered during command processing or button execution and dispatches fallback error responses.
 */
export async function handleInteraction(interaction) {
    try {
        // Router for Slash Commands
        if (interaction.isChatInputCommand()) {
            const command = commands[interaction.commandName];
            if (!command) return;

            await command.execute(interaction);
            return;
        }

        // Router for Interactive UI Buttons
        if (interaction.isButton()) {
            const customId = interaction.customId;

            // Ignore buttons not belonging to server control actions
            if (!['server_start', 'server_stop', 'server_restart'].includes(customId)) {
                return;
            }

            const action = customId.replace('server_', '');

            // Enforce Maintenance Mode restriction
            if (configManager.isMaintenanceMode()) {
                return interaction.reply({
                    content: '🔧 **Maintenance mode is active!** You cannot start or stop the server right now. Please try again later.',
                    flags: MessageFlags.Ephemeral 
                });
            }

            // Enforce role-based button permissions
            if (!canUseButton(interaction.member, action)) {
                return interaction.reply({
                    content: `❌ You do not have the required role permission to use the **${action}** button.`,
                    flags: MessageFlags.Ephemeral 
                });
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral  });

            let success = false;

            // Delegate server actions to serverManager
            if (action === 'start') {
                success = await serverManager.startPrimaryServer();
            } else if (action === 'stop') {
                success = await serverManager.stopAllServers();
            } else if (action === 'restart') {
                success = await serverManager.restartAllServers();
            }

            // Dispatch result confirmation back to user
            if (success) {
                await interaction.editReply({
                    content: `✅ Successfully sent **${action}** command to the server(s)! Status will update shortly.`
                });
            } else {
                await interaction.editReply({
                    content: `❌ Failed to execute **${action}** command. Check bot logs for details.`
                });
            }
        }
    } catch (error) {
        console.error('[InteractionCreate] Error handling interaction:', error);

        const errorMessage = { content: '❌ An error occurred while executing this action.', flags: MessageFlags.Ephemeral  };

        // Dispatch fallback response ensuring no broken interaction state
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp(errorMessage).catch(() => { });
        } else {
            await interaction.reply(errorMessage).catch(() => { });
        }
    }
}