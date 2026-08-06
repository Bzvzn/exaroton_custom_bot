import { Client, GatewayIntentBits, Events } from 'discord.js';
import { configManager } from '../config/configManager.js';
import { serverManager } from '../services/serverManager.js';
import { handleInteraction } from './events/interactionCreate.js';
import { createStatusEmbed } from './components/embed.js';
import { createControlButtons } from './components/buttons.js';
import { registerCommands } from './utils/deployCommands.js';


export const discordClient = new Client({
    intents: [GatewayIntentBits.Guilds]
});

/**
 * Helper function to sync the Discord embed with current server status.
 * Can be called on startup and on Exaroton status events.
 */
async function syncStatusMessage() {
    const setupData = configManager.getDiscordSetup();
    if (!setupData || !setupData.channelId || !setupData.messageId) return;

    try {
        const channel = await discordClient.channels.fetch(setupData.channelId).catch(() => null);
        if (!channel) return;

        const message = await channel.messages.fetch(setupData.messageId).catch(() => null);
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

    } catch (error) {
        console.error('[Discord] Failed to sync status embed:', error.message);
    }
}


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

    serverManager.on('targetsChanged', async () => {
        console.log('[Discord] Target servers changed, syncing embed...');
        await syncStatusMessage();
    });

    // ==========================================
    // 2. DISCORD EVENTS (Ready & Interactions)
    // ==========================================
    discordClient.once(Events.ClientReady, async (readyClient) => {
        console.log(`[Discord] Bot is online and logged in as ${readyClient.user.tag}!`);
        await registerCommands();

        console.log('[Discord] Performing initial sync of status embed...');
        await syncStatusMessage();
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

/**
 * Safely disconnects the Discord bot.
 */
export async function stopDiscordBot() {
    if (discordClient && discordClient.isReady()) {
        console.log('[Discord] Disconnecting bot gracefully...');
        discordClient.destroy();
        console.log('[Discord] Bot disconnected.');
    }
}