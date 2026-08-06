import { configManager } from '../../config/configManager.js';
import { serverManager } from '../../services/serverManager.js';
import { canUseButton } from '../utils/permissions.js';

import * as setupCommand from '../commands/setup.js';
import * as configCommand from '../commands/config.js';

const commands = {
    setup: setupCommand,
    config: configCommand
};

export async function handleInteraction(interaction) {
    try {
        if (interaction.isChatInputCommand()) {
            const command = commands[interaction.commandName];
            if (!command) return;

            await command.execute(interaction);
            return;
        }

        if (interaction.isButton()) {
            const customId = interaction.customId;

            if (!['server_start', 'server_stop', 'server_restart'].includes(customId)) {
                return;
            }

            const action = customId.replace('server_', '');

            if (configManager.isMaintenanceMode()) {
                return interaction.reply({
                    content: '🔧 **Maintenance mode is active!** You cannot start or stop the server right now. Please try again later.',
                    ephemeral: true
                });
            }

            if (!canUseButton(interaction.member, action)) {
                return interaction.reply({
                    content: `❌ You do not have the required role permission to use the **${action}** button.`,
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });

            let success = false;

            if (action === 'start') {
                success = await serverManager.startPrimaryServer();
            } else if (action === 'stop') {
                success = await serverManager.stopAllServers();
            } else if (action === 'restart') {
                success = await serverManager.restartAllServers();
            }

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

        const errorMessage = { content: '❌ An error occurred while executing this action.', ephemeral: true };
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp(errorMessage).catch(() => { });
        } else {
            await interaction.reply(errorMessage).catch(() => { });
        }
    }
}