import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { database } from '../datas/database.js';

/**
 * @typedef {Object} DiscordSetupData
 * @property {string} channelId - The ID of the Discord channel where the status embed is posted.
 * @property {string} messageId - The ID of the status embed message itself.
 */

/**
 * Centralized manager for all configurations.
 * Handles environment variables (.env), static config (config.json), 
 * and dynamic runtime settings stored in the SQLite database.
 */
class ConfigManager {
    constructor() {
        /**
         * @type {Object} Parsed contents of the static config.json file.
         */
        this.staticConfig = {};
    }


    /**
     * Initializes the configuration manager.
     * Loads environment variables, validates required tokens, and reads the config.json.
     * 
     * @throws {Error} If required environment variables are missing.
     */
    init() {
        // Load environment variables from .env file
        dotenv.config();

        // Validate that critical secrets are present
        const requiredEnvs = ['DISCORD_TOKEN', 'EXAROTON_TOKEN'];
        const missing = requiredEnvs.filter(env => !process.env[env]);

        if (missing.length > 0) {
            const error = new Error(`[ConfigManager] FATAL ERROR: Missing required environment variables: ${missing.join(', ')}`);
            error.code = 'MISSING_ENV_VALUE';
            throw error;
        }

        // Load static config.json if it exists
        const currentDir = path.dirname(fileURLToPath(import.meta.url));
        const configPath = path.resolve(currentDir, '../../config.json');

        if (fs.existsSync(configPath)) {
            try {
                const rawData = fs.readFileSync(configPath, 'utf-8');
                this.staticConfig = JSON.parse(rawData);
                console.log('[ConfigManager] Static config.json loaded.');
            } catch (error) {
                console.error('[ConfigManager] Error parsing config.json:', error);
            }
        }

        console.log('[ConfigManager] Environment variables validated successfully.');
    }

    // ==========================================
    // ENVIRONMENT VARIABLES (Secrets)
    // ==========================================


    /**
     * Gets the Discord Bot token.
     * @returns {string} The Discord API token.
     */
    get discordToken() {
        return process.env.DISCORD_TOKEN;
    }


    /**
     * Gets the Exaroton API token.
     * @returns {string} The Exaroton API token.
     */
    get exarotonToken() {
        return process.env.EXAROTON_TOKEN;
    }

    // ==========================================
    // DYNAMIC SETTINGS (SQLite Database)
    // ==========================================


    /**
     * Retrieves the list of managed Exaroton server IDs from the database.
     * 
     * @returns {Array<string>} An array of server IDs. Returns an empty array if none are configured.
     */
    getServerIds() {
        return database.getSetting('serverIds') || [];
    }


    /**
     * Saves the list of managed Exaroton server IDs to the database.
     * 
     * @param {Array<string>} ids - The array of server IDs to store.
     * @returns {boolean} True if successfully saved, false otherwise.
     */
    setServerIds(ids) {
        if (!Array.isArray(ids)) {
            console.error('[ConfigManager] setServerIds expects an array of strings.');
            return false;
        }
        return database.setSetting('serverIds', ids);
    }


    /**
     * Adds a new backend server to the end of the server list.
     * 
     * @param {string} newId - The Exaroton ID of the new backend server.
     * @returns {boolean} True if added, false if it already exists or failed to save.
     */
    addBackendServerId(newId) {
        const currentIds = this.getServerIds();

        if (currentIds.includes(newId)) {
            console.log(`[ConfigManager] Server ${newId} is already in the list.`);
            return false;
        }

        currentIds.push(newId);
        return this.setServerIds(currentIds);
    }


    /**
     * Sets or replaces the primary Proxy server (which must always be at Index 0).
     * 
     * @param {string} proxyId - The Exaroton ID of the proxy server.
     * @returns {boolean} True if successfully saved.
     */
    setPrimaryServerId(proxyId) {
        const currentIds = this.getServerIds();

        if (currentIds.length === 0) {
            return this.setServerIds([proxyId]);
        }

        currentIds[0] = proxyId;
        return this.setServerIds(currentIds);
    }


    /**
     * Retrieves a structured overview of the currently configured servers.
     * Useful for setup displays, debugging, or Discord info commands.
     * 
     * @returns {{ hasServers: boolean, total: number, primary: string|null, backends: Array<string> }} 
     * An object containing the categorized server IDs.
     */
    getServerConfigOverview() {
        const ids = this.getServerIds();

        if (ids.length === 0) {
            return {
                hasServers: false,
                total: 0,
                primary: null,
                backends: []
            };
        }

        return {
            hasServers: true,
            total: ids.length,
            primary: ids[0],               // Index 0 is always the Proxy / Primary
            backends: ids.slice(1)       // Everything else is a backend server
        };
    }


    /**
     * Retrieves the Discord setup data (where the status embed is located).
     * 
     * @returns {DiscordSetupData|null} The setup data, or null if the bot hasn't been set up yet.
     */
    getDiscordSetup() {
        return database.getSetting('discordSetup');
    }


    /**
     * Saves the Discord setup data to the database.
     * 
     * @param {string} channelId - The ID of the channel.
     * @param {string} messageId - The ID of the message.
     * @returns {boolean} True if successfully saved, false otherwise.
     */
    setDiscordSetup(channelId, messageId) {
        if (!channelId || !messageId) {
            console.error('[ConfigManager] setDiscordSetup requires both channelId and messageId.');
            return false;
        }
        return database.setSetting('discordSetup', { channelId, messageId });
    }

    // ==========================================
    // TWITCH CONFIGURATION
    // ==========================================


    /**
     * Gets the command name the Twitch bot should listen to from config.json.
     * Defaults to '!start' if not specified.
     * 
     * @returns {string} The command string (e.g., '!startmc').
     */
    getTwitchCommand() {
        return this.staticConfig?.twitch?.commandName || '!startmc';
    }


    /**
     * Retrieves the connected Twitch channel name from the database.
     * 
     * @returns {string|null} The Twitch channel name, or null if not configured.
     */
    getTwitchChannel() {
        return database.getSetting('twitchChannel');
    }


    /**
     * Saves the Twitch channel name to the database.
     * 
     * @param {string} channelName - The name of the Twitch channel to monitor.
     * @returns {boolean} True if successfully saved, false otherwise.
     */
    setTwitchChannel(channelName) {
        if (!channelName || typeof channelName !== 'string') {
            console.error('[ConfigManager] setTwitchChannel requires a valid string.');
            return false;
        }

        // Remove '#' if the user accidentally included it, tmi.js handles it
        const cleanChannelName = channelName.replace(/^#/, '').toLowerCase();

        return database.setSetting('twitchChannel', cleanChannelName);
    }

    // ==========================================
    // ROLE PERMISSIONS (Buttons)
    // ==========================================


    /**
     * Retrieves the role permissions for discord server buttons.
     * 
     * @returns {{ start: Array<string>, stop: Array<string>, restart: Array<string> }}
     */
    getButtonPermissions() {
        const defaultPerms = { start: [], stop: [], restart: [] };
        return database.getSetting('buttonPermissions') || defaultPerms;
    }


    /**
     * Updates the allowed roles for a specific button action.
     * 
     * @param {'start'|'stop'|'restart'} action - The button action.
     * @param {Array<string>} roleIds - Array of Discord Role IDs allowed to use this action.
     * @returns {boolean} True if successfully saved.
     */
    setButtonPermission(action, roleIds) {
        if (!['start', 'stop', 'restart'].includes(action)) return false;

        const currentPerms = this.getButtonPermissions();
        currentPerms[action] = roleIds;

        return database.setSetting('buttonPermissions', currentPerms);
    }


    /**
     * Retrieves the required Twitch permission level to use the start command.
     * 
     * @returns {'everyone'|'subscriber'|'vip'|'moderator'|'broadcaster'} The permission level. Defaults to 'moderator'.
     */
    getTwitchCommandPermission() {
        return database.getSetting('twitchCommandPermission') || 'moderator';
    }


    /**
     * Saves the required Twitch permission level for the start command.
     * 
     * @param {string} permissionLevel - The required permission level.
     * @returns {boolean} True if successfully saved, false if invalid.
     */
    setTwitchCommandPermission(permissionLevel) {
        const validLevels = ['everyone', 'subscriber', 'vip', 'moderator', 'broadcaster'];

        if (!validLevels.includes(permissionLevel)) {
            console.error(`[ConfigManager] Invalid Twitch permission level. Must be one of: ${validLevels.join(', ')}`);
            return false;
        }

        return database.setSetting('twitchCommandPermission', permissionLevel);
    }
}

// Export as a Singleton
export const configManager = new ConfigManager();