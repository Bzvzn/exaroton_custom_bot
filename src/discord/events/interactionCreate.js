import { Events } from 'discord.js';
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

            if (!canUseButton(interaction.member, action)) {
                return interaction.reply({
                    content: `❌ You do not have the required role permission to use the **${action}** button.`,
                    ephemeral: true
                });
            }

            await interaction.deferReply({ ephemeral: true });

            let success = false;
            let actionName = '';

            if (action === 'start') {
                actionName = 'start';
                success = await serverManager.startPrimaryServer();
            } else if (action === 'stop') {
                actionName = 'stop';
                success = await serverManager.stopAllServers();
            } else if (action === 'restart') {
                actionName = 'restart';
                success = await serverManager.restartAllServers();
            }

            if (success) {
                await interaction.editReply({
                    content: `✅ Successfully sent **${actionName}** command to the server(s)! Status will update shortly.`
                });
            } else {
                await interaction.editReply({
                    content: `❌ Failed to execute **${actionName}** command. Check bot logs for details.`
                });
            }
        }
    } catch (error) {
        console.error('[InteractionCreate] Error handling interaction:', error);
        
        const errorMessage = { content: '❌ An error occurred while executing this action.', ephemeral: true };
        if (interaction.deferred || interaction.replied) {
            await interaction.followUp(errorMessage).catch(() => {});
        } else {
            await interaction.reply(errorMessage).catch(() => {});
        }
    }
}