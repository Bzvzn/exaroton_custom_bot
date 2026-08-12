import { Client, GatewayIntentBits, Events } from 'discord.js';
import { configManager } from '../config/configManager.js';
import { serverManager } from '../services/serverManager.js';
import { handleInteraction } from './events/interactionCreate.js';
import { createStatusEmbed } from './components/embed.js';
import { createControlButtons } from './components/buttons.js';
import { registerCommands } from './utils/deployCommands.js';


/**
 * Singleton Discord Client instance initialized with minimal required gateway intents.
 * @type {Client}
 */
export const discordClient = new Client({
    intents: [GatewayIntentBits.Guilds]
});


/**
 * Synchronizes the configured persistent status message in Discord with current Exaroton server states.
 * Fetches the target channel and message using persisted setup identifiers, then updates the status embed and UI control buttons.
 * 
 * @returns {Promise<void>} Resolves when status synchronization completes or safely aborts if unconfigured/unreachable.
 * @throws {Error} Logs errors encountered during channel or message fetching and embed editing.
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


/**
 * Initializes and starts the Discord bot service.
 * Registers event listeners for ServerManager state changes, binds Discord gateway event handlers,
 * deploys slash commands, and authenticates using the configured Discord bot token.
 * 
 * @returns {Promise<boolean>} Resolves to true upon successful login authentication.
 * @throws {Error} Throws an error with code 'DISCORD_FAIL' if authentication fails.
 */
export async function startDiscordBot() {

    // ==========================================
    // 1. CONNECTION TO EXAROTON EVENTS
    // ==========================================
    
    /**
     * Listener triggered when an Exaroton server changes lifecycle state.
     * Updates the status embed message in real-time.
     */
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


    /**
     * Listener triggered when monitored Exaroton server targets or maintenance settings change.
     * Forces an immediate synchronization of the status embed.
     */
    serverManager.on('targetsChanged', async () => {
        console.log('[Discord] Target servers changed, syncing embed...');
        await syncStatusMessage();
    });

    
    // ==========================================
    // 2. DISCORD GATEWAY EVENTS
    // ==========================================
    
    /**
     * Once-listener executed when the client establishes connection and reaches Ready status.
     */
    discordClient.once(Events.ClientReady, async (readyClient) => {
        console.log(`[Discord] Bot is online and logged in as ${readyClient.user.tag}!`);
        await registerCommands();

        console.log('[Discord] Performing initial sync of status embed...');
        await syncStatusMessage();

        setInterval(async () => {
            await syncStatusMessage();
        }, 5 * 60 * 1000);
    });

    /**
     * Event listener delegating incoming interactions (slash commands, button clicks) to the interaction router.
     */
    discordClient.on(Events.InteractionCreate, async (interaction) => {
        await handleInteraction(interaction);
    });


    // ==========================================
    // 3. BOT LOGIN
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
 * Gracefully disconnects and destroys the active Discord bot client session.
 * Recommended during application shutdown procedures.
 * 
 * @returns {Promise<void>} Resolves when client destruction finishes.
 */
export async function stopDiscordBot() {
    if (discordClient && discordClient.isReady()) {
        console.log('[Discord] Disconnecting bot gracefully...');
        discordClient.destroy();
        console.log('[Discord] Bot disconnected.');
    }
}