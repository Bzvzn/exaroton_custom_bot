import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { database } from '../datas/database.js';

/**
 * @typedef {Object} DiscordSetupData
 * @property {string} channelId - The Discord channel ID where the status embed is deployed.
 * @property {string} messageId - The Discord message ID of the active status embed.
 */

/**
 * @typedef {Object} ServerConfigOverview
 * @property {boolean} hasServers - Indicates if at least one server ID is stored.
 * @property {number} total - Total count of configured Exaroton servers.
 * @property {string|null} primary - Exaroton ID of the Proxy / Primary server (Index 0).
 * @property {string[]} backends - Array of Exaroton IDs for configured backend servers.
 */

/**
 * @typedef {Object} ButtonPermissions
 * @property {string[]} start - Array of Discord Role IDs permitted to start servers.
 * @property {string[]} stop - Array of Discord Role IDs permitted to stop servers.
 * @property {string[]} restart - Array of Discord Role IDs permitted to restart servers.
 */


/**
 * Centralized configuration manager.
 * Orchestrates environment variables (.env), static files (config.json),
 * and dynamic runtime settings stored within the SQLite database.
 */
class ConfigManager {

    /**
     * Instantiates the ConfigManager.
     * Initializes an empty in-memory cache for static configuration settings.
     */
    constructor() {
        /**
         * Parsed contents of the static config.json file.
         * @type {Object}
         */
        this.staticConfig = {};
    }


    /**
     * Initializes the configuration subsystem.
     * Loads environment variables from .env, enforces required API token presence,
     * and attempts to parse static config.json settings.
     * 
     * @returns {void}
     * @throws {Error} Throws an error with code 'MISSING_ENV_VALUE' if DISCORD_TOKEN or EXAROTON_TOKEN is missing.
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
     * Retrieves the Discord Bot token from environment variables.
     * 
     * @type {string|undefined}
     * @readonly
     */
    get discordToken() {
        return process.env.DISCORD_TOKEN;
    }


    /**
     * Retrieves the Exaroton API token from environment variables.
     * 
     * @type {string|undefined}
     * @readonly
     */
    get exarotonToken() {
        return process.env.EXAROTON_TOKEN;
    }


    // ==========================================
    // DYNAMIC SETTINGS (SQLite Database)
    // ==========================================


    /**
     * Retrieves all configured Exaroton server IDs from the database.
     * 
     * @returns {string[]} An array of server IDs. Returns an empty array if none are stored.
     */
    getServerIds() {
        const value = database.getSetting('serverIds');
        return Array.isArray(value) ? value : [];
    }


    /**
     * Normalizes, deduplicates, and saves an array of Exaroton server IDs to the database.
     * 
     * @param {string[]} ids - An array of Exaroton server IDs to store.
     * @returns {boolean} True if successfully saved to the database; false otherwise.
     */
    setServerIds(ids) {
        if (!Array.isArray(ids)) {
            console.error('[ConfigManager] setServerIds expects an array of strings.');
            return false;
        }

        if (ids.length === 0) {
            return database.setSetting('serverIds', []);
        }

        const cleaned = ids
            .map(id => this._normalizeServerId(id))
            .filter(Boolean);

        const unique = [...new Set(cleaned)];

        if (unique.length === 0) {
            console.error('[ConfigManager] setServerIds requires at least one valid server ID.');
            return false;
        }

        return database.setSetting('serverIds', unique);
    }


    /**
     * Appends a new backend Exaroton server ID to the existing server target list.
     * Requires a primary server (index 0) to already be configured.
     * 
     * @param {string} newId - The Exaroton ID of the backend server to add.
     * @returns {boolean} True if added and saved; false if invalid, empty primary list, or duplicate.
     */
    addBackendServerId(newId) {
        const normalized = this._normalizeServerId(newId);

        if (!normalized) {
            console.error('[ConfigManager] addBackendServerId requires a valid non-empty server ID.');
            return false;
        }

        const currentIds = this.getServerIds();

        if (!Array.isArray(currentIds) || currentIds.length === 0) {
            console.error('[ConfigManager] Cannot add backend: primary server must be configured first.');
            return false;
        }

        if (currentIds.includes(normalized)) {
            console.log(`[ConfigManager] Server ${normalized} is already in the list.`);
            return false;
        }

        return this.setServerIds([...currentIds, normalized]);
    }


    /**
     * Configures or replaces the primary Proxy server ID (always fixed at Index 0).
     * 
     * @param {string} proxyId - The Exaroton ID of the primary/proxy server.
     * @returns {boolean} True if successfully updated and saved; false if proxyId is invalid.
     */
    setPrimaryServerId(proxyId) {
        const normalized = this._normalizeServerId(proxyId);
        if (!normalized) {
            console.error('[ConfigManager] setPrimaryServerId requires a valid non-empty server ID.');
            return false;
        }

        const currentIds = this.getServerIds();
        const safeIds = Array.isArray(currentIds) ? currentIds : [];

        if (safeIds.length === 0) return this.setServerIds([normalized]);

        safeIds[0] = normalized;
        return this.setServerIds(safeIds);
    }


    /**
     * Constructs a structured overview breakdown of all configured Exaroton servers.
     * 
     * @returns {ServerConfigOverview} Object containing overall counts, primary ID, and backend IDs.
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
     * Retrieves Discord channel and message identifiers for the live status embed.
     * 
     * @returns {DiscordSetupData|null} The setup data object, or null if unconfigured.
     */
    getDiscordSetup() {
        return database.getSetting('discordSetup');
    }


    /**
     * Stores the Discord channel and message IDs for tracking the active status embed.
     * 
     * @param {string} channelId - The Discord Channel ID containing the embed.
     * @param {string} messageId - The Discord Message ID of the embed.
     * @returns {boolean} True if successfully persisted; false if parameters are missing.
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
     * Retrieves the designated chat command string for Twitch chat triggers.
     * Reads from staticConfig with a fallback to '!startmc'.
     * 
     * @returns {string} The active command string (e.g., '!startmc').
     */
    getTwitchCommand() {
        return this.staticConfig?.twitch?.commandName || '!startmc';
    }


    /**
     * Retrieves the configured Twitch channel name from the database.
     * 
     * @returns {string|null} The monitored channel name, or null if unconfigured.
     */
    getTwitchChannel() {
        return database.getSetting('twitchChannel');
    }


    /**
     * Cleans and saves a Twitch channel name to the database.
     * Strips leading '#' symbols and converts string to lowercase.
     * 
     * @param {string} channelName - The raw Twitch channel name.
     * @returns {boolean} True if successfully persisted; false if input is invalid or non-string.
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
    // ROLE PERMISSIONS
    // ==========================================


    /**
     * Retrieves role permission mappings for Discord interactive buttons.
     * 
     * @returns {ButtonPermissions} Object mapping actions ('start', 'stop', 'restart') to allowed Role IDs.
     */
    getButtonPermissions() {
        const defaultPerms = { start: [], stop: [], restart: [] };
        return database.getSetting('buttonPermissions') || defaultPerms;
    }


    /**
     * Updates and persists allowed Discord Role IDs for a specific button action.
     * 
     * @param {'start'|'stop'|'restart'} action - The button action type to update.
     * @param {string[]} roleIds - Array of Discord Role IDs granted permission.
     * @returns {boolean} True if saved successfully; false if action or roleIds array is invalid.
     */
    setButtonPermission(action, roleIds) {
        if (!['start', 'stop', 'restart'].includes(action)) return false;
        if (!Array.isArray(roleIds)) return false;

        const cleanedRoles = [...new Set(
            roleIds
                .filter(r => typeof r === 'string')
                .map(r => r.trim())
                .filter(Boolean)
        )];

        const currentPerms = this.getButtonPermissions();
        currentPerms[action] = cleanedRoles;

        return database.setSetting('buttonPermissions', currentPerms);
    }


    /**
     * Retrieves normalized permission levels authorized to execute Twitch chat commands.
     * Defaults to ['broadcaster', 'moderator'] if unconfigured.
     * 
     * @returns {string[]} Array of allowed permission strings (e.g., ['broadcaster', 'moderator', 'vip']).
     */
    getTwitchCommandPermissions() {
        const defaultPerms = ['broadcaster', 'moderator'];
        const validLevels = new Set(['everyone', 'subscriber', 'vip', 'moderator', 'broadcaster']);
        const value = database.getSetting('twitchCommandPermissions');

        if (!Array.isArray(value) || value.length === 0) return defaultPerms;

        const normalized = [...new Set(
            value
                .filter(v => typeof v === 'string')
                .map(v => v.trim().toLowerCase())
                .filter(v => validLevels.has(v))
        )];

        return normalized.length > 0 ? normalized : defaultPerms;
    }


    /**
     * Validates and persists allowed Twitch user permission levels.
     * Note: If 'everyone' is provided, it supersedes all other levels.
     * 
     * @param {string[]} levels - Array of Twitch permission levels ('everyone', 'subscriber', 'vip', 'moderator', 'broadcaster').
     * @returns {boolean} True if saved successfully; false if no valid levels were provided.
     */
    setTwitchCommandPermissions(levels) {
        const validLevels = new Set(['everyone', 'subscriber', 'vip', 'moderator', 'broadcaster']);

        const cleaned = this._normalizeStringArray(levels)
            .map(l => l.toLowerCase())
            .filter(l => validLevels.has(l));

        const unique = [...new Set(cleaned)];

        if (unique.length === 0) {
            console.error('[ConfigManager] No valid Twitch permission levels provided.');
            return false;
        }

        if (unique.includes('everyone')) {
            return database.setSetting('twitchCommandPermissions', ['everyone']);
        }

        return database.setSetting('twitchCommandPermissions', unique);
    }


    // ==========================================
    // MAINTENANCE MODE
    // ==========================================

    /**
     * Checks whether maintenance mode is currently active.
     * 
     * @returns {boolean} True if maintenance mode is enabled; false otherwise.
     */
    isMaintenanceMode() {
        return database.getSetting('maintenanceMode') || false;
    }

    /**
     * Updates the active status of maintenance mode.
     * 
     * @param {boolean} state - True to enable maintenance mode, false to disable it.
     * @returns {boolean} True if the state was saved successfully.
     */
    setMaintenanceMode(state) {
        return database.setSetting('maintenanceMode', !!state);
    }


    // ==========================================
    // PRIVATE / INTERNAL HELPERS
    // ==========================================


    /**
     * Sanitizes a raw server ID input string by trimming whitespace and stripping leading hashes.
     * 
     * @private
     * @param {*} id - Raw server ID input value.
     * @returns {string|null} Trimmed server ID string, or null if input is non-string or empty.
     */
    _normalizeServerId(id) {
        if (typeof id !== 'string') return null;
        const clean = id.trim().replace(/^#/, '');
        return clean.length > 0 ? clean : null;
    }


    /**
     * Filters an input array ensuring all items are non-empty, trimmed strings.
     * 
     * @private
     * @param {*} values - Raw input value expected to be an array.
     * @returns {string[]} Sanitized array containing non-empty string values.
     */
    _normalizeStringArray(values) {
        if (!Array.isArray(values)) return [];
        return values
            .filter(v => typeof v === 'string')
            .map(v => v.trim())
            .filter(Boolean);
    }
}

// Export as a Singleton
export const configManager = new ConfigManager();