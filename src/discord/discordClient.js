import { Client, GatewayIntentBits, Events } from 'discord.js';
import { configManager } from '../config/configManager.js';
import { serverManager } from '../services/serverManager.js';
import { handleInteraction } from './events/interactionCreate.js';
import { createStatusEmbed } from './components/embed.js';
import { createControlButtons } from './components/buttons.js';


export const discordClient = new Client({
    intents: [GatewayIntentBits.Guilds] 
});


export async function startDiscordBot() {

    // ==========================================
    // 1. Connection to exaroton
    // ==========================================
    serverManager.on('statusUpdate', async (serverId, newStatus) => {
        console.log(`[Discord Event] Server ${serverId} changed status to ${newStatus}`);
        
        const setupData = configManager.getDiscordSetup();
        if (!setupData || !setupData.channelId || !setupData.messageId) return;

        try {
            const channel = await discordClient.channels.fetch(setupData.channelId);
            if (!channel) return;

            const message = await channel.messages.fetch(setupData.messageId);
            if (!message) return;

            // Fetch fresh status data and update the embed & buttons
            const serverData = await serverManager.getStatuses();
            const embed = createStatusEmbed(serverData);

            const serverStatus = serverData ? serverData.status : 0;
            const buttons = createControlButtons(serverStatus);

            await message.edit({
                embeds: [embed],
                components: [buttons]
            });

            console.log('[Discord] Status embed successfully updated in real-time.');
        } catch (error) {
            console.error('[Discord] Failed to update status embed:', error);
        }
    });

    // ==========================================
    // 2. DISCORD EVENTS (Ready & Interactions)
    // ==========================================
    discordClient.once(Events.ClientReady, (readyClient) => {
        console.log(`[Discord] Bot is online and logged in as ${readyClient.user.tag}!`);
    });

    discordClient.on(Events.InteractionCreate, async (interaction) => {
        await handleInteraction(interaction);
    });


    // ==========================================
    // 3. LOGIN
    // ==========================================
    try {
        await discordClient.login(configManager.discordToken);
        return true;
    } catch (err) {
        const error = new Error('[Discord] FATAL ERROR: Failed to login. Check your DISCORD_TOKEN.');
        error.code = 'DISCORD_FAIL';
        throw error;
    }
}