import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { serverManager } from '../../services/serverManager.js';
import { configManager } from '../../config/configManager.js';
import { createStatusEmbed } from '../components/embed.js';
import { createControlButtons } from '../components/buttons.js';
import { isServerAdmin } from '../utils/permissions.js';


/**
 * Slash Command Builder definition for the `/setup` command.
 * Restricts default guild member usage to administrators with `ManageGuild` permissions.
 * Deploys the persistent Minecraft status embed and control UI components.
 * 
 * @type {SlashCommandBuilder}
 */
export const data = new SlashCommandBuilder()
    .setName('setup')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDescription('Deploys the live Minecraft server status embed and control buttons.');


/**
 * Executes the `/setup` slash command interaction.
 * Verifies guild administrative rights, fetches initial server statuses,
 * posts the interactive control panel message, and saves channel/message IDs to configuration.
 * 
 * @param {ChatInputCommandInteraction} interaction - The Discord chat input command interaction object.
 * @returns {Promise<void>} Resolves when the interaction deferred reply is finalized.
 * @throws {Error} Logs and handles errors during status retrieval, message deployment, or configuration persistence.
 */
export async function execute(interaction) {
    // Verify admin permissions via utility function
    if (!isServerAdmin(interaction.member)) {
        return interaction.reply({
            content: '❌ You do not have permission to use this command.',
            flags: MessageFlags.Ephemeral 
        });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral  });

    try {
        // Fetch real-time status details for configured Exaroton targets
        const serverData = await serverManager.getStatuses();
        const embed = createStatusEmbed(serverData);

        const serverStatus = serverData ? serverData.status : 0;
        const buttons = createControlButtons(serverStatus);

        // Send the main interactive embed message to the current channel
        const message = await interaction.channel.send({
            embeds: [embed],
            components: [buttons]
        });

        // Persist channelId and messageId in database for ongoing updates
        configManager.setDiscordSetup(interaction.channelId, message.id);

        await interaction.editReply({
            content: '✅ Server status embed successfully deployed here!'
        });

    } catch (error) {
        console.error('[Command:setup] Failed to deploy embed:', error);
        await interaction.editReply({
            content: '❌ Failed to deploy the status embed. Check console for details.'
        });
    }
}