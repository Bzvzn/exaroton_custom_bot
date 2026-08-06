import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { serverManager } from '../../services/serverManager.js';
import { configManager } from '../../config/configManager.js';
import { createStatusEmbed } from '../components/embed.js';
import { createControlButtons } from '../components/buttons.js';
import { isServerAdmin } from '../utils/permissions.js';

export const data = new SlashCommandBuilder()
    .setName('setup')
    .setDMPermission(false)
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDescription('Deploys the live Minecraft server status embed and control buttons.');

export async function execute(interaction) {
    if (!isServerAdmin(interaction.member)) {
        return interaction.reply({
            content: '❌ You do not have permission to use this command.',
            ephemeral: true
        });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        const serverData = await serverManager.getStatuses();
        const embed = createStatusEmbed(serverData);

        const serverStatus = serverData ? serverData.status : 0;
        const buttons = createControlButtons(serverStatus);

        const message = await interaction.channel.send({
            embeds: [embed],
            components: [buttons]
        });

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