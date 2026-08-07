import tmi from 'tmi.js';
import { configManager } from '../config/configManager.js';
import { serverManager } from '../services/serverManager.js';


/**
 * Singleton instance of the active Twitch IRC client (`tmi.js`).
 * @type {tmi.Client|null}
 */
let twitchClient = null;


/**
 * Initializes and connects the Twitch chat bot client.
 * Subscribes to chat message events, listens for designated server control commands (e.g. `!startmc`),
 * and enforces maintenance mode checks along with user permission evaluations.
 * 
 * @returns {Promise<void>} Resolves when the client successfully connects or safely exits if unconfigured/unreachable.
 * @throws {Error} Logs connection errors during `twitchClient.connect()` or server trigger failures.
 */
export async function startTwitchBot() {
    const channel = configManager.getTwitchChannel();

    if (!channel) {
        console.log('[Twitch] No channel configured yet. Skipping Twitch setup.');
        return;
    }

    twitchClient = new tmi.Client({
        channels: [channel]
    });

    try {
        await twitchClient.connect();
        console.log(`[Twitch] Connected to channel: #${channel}`);
    } catch (error) {
        console.error('[Twitch] Failed to connect:', error);
        return;
    }


    /**
     * Event listener for Twitch chat messages.
     * Evaluates incoming message content against configured command triggers and checks user permissions.
     */
    twitchClient.on('message', async (channel, tags, message, self) => {
        if (self) return;

        const targetCommand = configManager.getTwitchCommand().toLowerCase();
        const userMessage = message.trim().toLowerCase();

        if (userMessage !== targetCommand) return;

        // Block command execution if maintenance mode is enabled
        if (configManager.isMaintenanceMode()) {
            console.log(`[Twitch] User ${tags.username} tried to start the server, but Maintenance Mode is active.`);
            return; 
        }

        // Validate user permission level
        if (!hasPermission(tags)) {
            console.log(`[Twitch] User ${tags.username} tried to use ${targetCommand}, but lacked permissions.`);
            return;
        }

        console.log(`[Twitch] User ${tags.username} executed ${targetCommand}. Starting server...`);

        try {
            await serverManager.startPrimaryServer();
        } catch (error) {
            console.error(`[Twitch] Error starting server via Twitch command:`, error);
        }
    });
}


/**
 * Gracefully disconnects the active Twitch chat bot client session if open.
 * Recommended during application shutdown or channel reconfiguration.
 * 
 * @returns {Promise<void>} Resolves when the client disconnection process completes.
 */
export async function stopTwitchBot() {
    if (twitchClient && twitchClient.readyState() === 'OPEN') {
        console.log('[Twitch] Disconnecting bot gracefully...');
        await twitchClient.disconnect();
        console.log('[Twitch] Bot disconnected.');
    }
}


/**
 * Evaluates whether a Twitch user holds the required permissions to execute server triggers.
 * Checks badges and user tags against permitted roles stored in the database ('everyone', 'broadcaster', 'moderator', 'vip', 'subscriber').
 * 
 * @private
 * @param {import('tmi.js').ChatUserstate} tags - The Twitch IRC user tags object accompanying a chat message.
 * @returns {boolean} True if the user satisfies at least one allowed permission requirement; false otherwise.
 */
function hasPermission(tags) {
    const allowedPerms = configManager.getTwitchCommandPermissions();
    
    if (allowedPerms.includes('everyone')) return true;

    const isBroadcaster = tags.badges?.broadcaster === '1';
    const isMod = tags.mod === true;
    const isVip = tags.badges?.vip === '1';
    const isSub = tags.subscriber === true;

    if (allowedPerms.includes('broadcaster') && isBroadcaster) return true;
    if (allowedPerms.includes('moderator') && isMod) return true;
    if (allowedPerms.includes('vip') && isVip) return true;
    if (allowedPerms.includes('subscriber') && isSub) return true;

    return false;
}