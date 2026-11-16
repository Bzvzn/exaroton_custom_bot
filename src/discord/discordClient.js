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
 * Periodic status sync timer reference for clean teardown.
 * @type {NodeJS.Timeout|null}
 */
let syncInterval = null;

/**
 * Prevents overlapping Discord message edits when multiple servers emit status events simultaneously.
 * @type {boolean}
 */
let isSyncing = false;

/**
 * Queues one additional sync if a new status event arrives while a sync is already in progress.
 * @type {boolean}
 */
let pendingSync = false;

/**
 * Synchronizes the configured persistent status message in Discord with current Exaroton server states.
 * Fetches the target channel and message using persisted setup identifiers, then updates the status embed and UI control buttons.
 * Includes retry handling for transient Discord API / network timeouts.
 * 
 * @param {number} [retries=2] - Number of retry attempts on transient network failures.
 * @returns {Promise<void>} Resolves when status synchronization completes or safely aborts if unconfigured/unreachable.
 */
async function syncStatusMessage(retries = 2) {
    // Abort silently if Discord client is not connected yet
    if (!discordClient || !discordClient.isReady()) return;

    const setupData = configManager.getDiscordSetup();
    if (!setupData || !setupData.channelId || !setupData.messageId) return;

    // Prevent concurrent edits if multiple statusUpdate events fire at once
    if (isSyncing) {
        pendingSync = true;
        return;
    }

    isSyncing = true;

    try {
        for (let attempt = 0; attempt <= retries; attempt++) {
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

                return; // Success, exit retry loop
            } catch (error) {
                // Unknown Message (10008) or Unknown Channel (10003) -> deleted in Discord, no point retrying
                if (error?.code === 10008 || error?.code === 10003) {
                    console.warn(`[Discord] Configured status message or channel no longer exists (Code ${error.code}).`);
                    return;
                }

                if (attempt < retries) {
                    console.warn(`[Discord] Sync status embed timed out/failed (${error.message}). Retrying in 3s...`);
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                } else {
                    console.error('[Discord] Failed to sync status embed after retries:', error.message);
                }
            }
        }
    } finally {
        isSyncing = false;
        if (pendingSync) {
            pendingSync = false;
            await syncStatusMessage(retries);
        }
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

    // Remove previous listeners to avoid duplicates on re-initialization
    serverManager.removeAllListeners('statusUpdate');
    serverManager.removeAllListeners('targetsChanged');

    /**
     * Listener triggered when an Exaroton server changes lifecycle state.
     * Updates the status embed message in real-time.
     */
    serverManager.on('statusUpdate', async (serverId, newStatus) => {
        console.log(`[Discord Event] Server ${serverId} changed status to ${newStatus}`);
        await syncStatusMessage();
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

        try {
            await registerCommands();
        } catch (cmdError) {
            console.error('[Discord] Failed to register slash commands:', cmdError.message);
        }

        console.log('[Discord] Performing initial sync of status embed...');
        await syncStatusMessage();

        if (syncInterval) clearInterval(syncInterval);
        syncInterval = setInterval(async () => {
            await syncStatusMessage();
        }, 5 * 60 * 1000);
    });

    /**
     * Log Discord WebSocket / Gateway errors safely so they don't crash the process.
     */
    discordClient.on(Events.Error, (error) => {
        console.error('[Discord] Client Gateway Error:', error.message);
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
        const error = new Error(`[Discord] FATAL ERROR: Failed to login (${err.message}). Check your DISCORD_TOKEN or network.`);
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
    if (syncInterval) {
        clearInterval(syncInterval);
        syncInterval = null;
    }

    if (discordClient && discordClient.isReady()) {
        console.log('[Discord] Disconnecting bot gracefully...');
        discordClient.destroy();
        console.log('[Discord] Bot disconnected.');
    }
}