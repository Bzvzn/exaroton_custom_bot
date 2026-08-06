import tmi from 'tmi.js';
import { configManager } from '../config/configManager';
import { serverManager } from '../services/serverManager';

let twitchClient = null;

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


    twitchClient.on('message', async (channel, tags, message, self) => {
        if (self) return;

        const targetCommand = configManager.getTwitchCommand().toLowerCase();
        const userMessage = message.trim().toLowerCase();

        if (userMessage !== targetCommand) return;

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
 * Safely disconnects the Twitch bot.
 */
export async function stopTwitchBot() {
    if (twitchClient && twitchClient.readyState() === 'OPEN') {
        console.log('[Twitch] Disconnecting bot gracefully...');
        await twitchClient.disconnect();
        console.log('[Twitch] Bot disconnected.');
    }
}


/**
 * Checks if the user has the required Twitch permissions.
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