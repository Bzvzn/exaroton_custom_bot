import { Client } from "exaroton";
import { EventEmitter } from "events";

/**
 * @typedef {Object} ServerSoftware
 * @property {string} name - Name of the Minecraft server software (e.g., Paper, Velocity).
 * @property {string} version - Exact version string (e.g., 1.20.4).
 */

/**
 * @typedef {Object} PlayerData
 * @property {number} count - Current number of connected players.
 * @property {number} max - Maximum configured player capacity.
 * @property {string[]} [list] - Array of player usernames currently online.
 */

/**
 * @typedef {Object} ServerStatusData
 * @property {string} id - The unique Exaroton server ID.
 * @property {string} name - The display name of the server.
 * @property {number} status - Exaroton status code (0 = Offline, 1 = Online, 2 = Starting, etc.).
 * @property {string} address - Server IP or hostname.
 * @property {number} port - Server connection port.
 * @property {string} motd - Message of the Day string.
 * @property {PlayerData} players - Current player statistics.
 * @property {ServerSoftware} software - Software environment details.
 * @property {ServerStatusData[]} [backends] - Array of aggregated backend server states (only present on Primary return object).
 */


/**
 * Manages connections, real-time WebSocket subscriptions, and lifecycle commands via the Exaroton API.
 * Handles both Single-Server setups and Multi-Server (Proxy + Backends) architectures.
 * 
 * @extends EventEmitter
 * @fires ServerManager#statusUpdate
 * @fires ServerManager#targetsChanged
 */
class ServerManager extends EventEmitter {

    /**
     * Instantiates the ServerManager.
     * Initializes empty state collections for API client, server instances, and server IDs.
     */
    constructor() {
        super();


        /**
         * The active Exaroton API Client instance.
         * @type {Client|null}
         */
        this.client = null;


        /**
         * Collection of instantiated Exaroton Server objects used for executing control commands.
         * @type {Array<Object>}
         */
        this.servers = [];


        /**
         * List of target Exaroton Server IDs. Index 0 is always designated as Primary (Proxy).
         * @type {string[]}
         */
        this.serverIds = [];
    }


    /**
     * Initializes the Exaroton API client instance with a secret token.
     * 
     * @param {string} apiToken - Secret authentication token provided by Exaroton.
     * @returns {boolean} True if successfully initialized.
     * @throws {Error} Throws an error with code 'MISSING_API_TOKEN' if apiToken is undefined or empty.
     */
    init(apiToken) {
        if (!apiToken) {
            const error = new Error('[ServerManager] Cannot initialize: API token is missing!');
            error.code = 'MISSING_API_TOKEN';
            throw error;
        }

        this.client = new Client(apiToken);
        console.log('[ServerManager] Exaroton API Client successfully initialized.');
        return true;
    }


    /**
     * Sets, validates, and subscribes to real-time status events for configured Exaroton target servers.
     * Automatically assigns Index 0 as Primary (Proxy) and subsequent items as backends.
     * Unsubscribes from previous WebSocket feeds prior to binding new ones.
     * 
     * @param {string|string[]} serverIds - A single server ID or an array of server IDs.
     * @returns {Promise<string[]>} Array of validated server IDs currently being monitored.
     * @throws {Error} Throws an error with code 'CLIENT_NOT_INITALIZED' if called before init().
     */
    async setServerTargets(serverIds) {
        if (!this.client) {
            const error = new Error('[ServerManager] Cannot set server targets: Client not initialized.');
            error.code = 'CLIENT_NOT_INITALIZED';
            throw error;
        }

        const rawIds = Array.isArray(serverIds)
            ? serverIds.filter(Boolean)
            : (serverIds ? [serverIds] : []);

        const ids = [...new Set(rawIds.map(id => id.trim()))];

        const validIds = [];
        const validServers = [];

        // Verify each ID using server.get() before subscribing
        for (const id of ids) {
            try {
                const server = this.client.server(id);

                const serverData = await server.get();

                if (!serverData || !serverData.id) {
                    throw new Error(`Invalid server data received for ID: ${id}`);
                }

                // Subscribe to Exaroton real-time status updates via WebSockets
                server.subscribe();

                server.on('status', (payload) => {
                    let statusCode;

                    if (typeof payload === 'object' && payload !== null) {


                        if (typeof payload.status === 'number') {
                            statusCode = payload.status;
                        } else {
                            console.error(`[ServerManager] API/Network Error for ${server.id}:`, payload);
                            statusCode = -1;
                        }
                    } else if (typeof payload === 'number') {
                        statusCode = payload;
                    } else {
                        console.warn(`[ServerManager] Unexpected payload for ${server.id}:`, payload);
                        statusCode = -1;
                    }

                    console.log(`[ServerManager] Live status update for ${server.id}: Status is now ${statusCode}`);

                    /**
                     * Emitted when a monitored server changes lifecycle status.
                     * @event ServerManager#statusUpdate
                     * @type {string} serverId - The Exaroton ID of the updated server.
                     * @type {number} newStatus - The new status code.
                     */
                    this.emit('statusUpdate', server.id, statusCode);
                });

                validIds.push(id);
                validServers.push(server);
            } catch (error) {
                console.warn(`[ServerManager] Invalid or unreachable Server ID ignored: ${id}`);
            }
        }

        if (ids.length > 0 && validIds.length === 0) {
            console.warn('[ServerManager] Aborting target update: All provided IDs were invalid. Keeping previous servers.');
            return [];
        }

        // Clean up previous subscriptions and listeners
        for (const oldServer of this.servers) {
            try {
                if (typeof oldServer.unsubscribe === 'function') {
                    try {
                        oldServer.unsubscribe();
                    } catch (e) { }
                }
                if (typeof oldServer.removeAllListeners === 'function') {
                    oldServer.removeAllListeners('status');
                }
            } catch (e) {
            }
        }

        this.serverIds = validIds;
        this.servers = validServers;


        /**
         * Emitted when the target server configuration is successfully updated.
         * @event ServerManager#targetsChanged
         * @type {string[]} validIds - Array of monitored server IDs.
         */
        this.emit('targetsChanged', validIds);

        console.log(`[ServerManager] Target servers updated. Monitoring ${this.servers.length} server(s).`);
        if (this.servers.length > 0) {
            console.log(`[ServerManager] Primary (Proxy) Server ID: ${this.serverIds[0]}`);
        }

        return validIds;
    }


    /**
     * Fetches real-time status metrics from all configured servers concurrently.
     * Structures output placing Index 0 as primary data with remaining servers grouped under `backends`.
     * 
     * @returns {Promise<ServerStatusData|null>} Aggregated status object, or null if no servers are configured or API call fails.
     */
    async getStatuses() {
        if (this.servers.length === 0) return null;

        try {
            const statuses = await Promise.all(
                this.servers.map(async (server) => {
                    try {
                        const serverData = await server.get();
                        return {
                            id: server.id,
                            name: serverData.name,
                            status: serverData.status,
                            address: serverData.address,
                            motd: serverData.motd,
                            port: serverData.port,
                            players: serverData.players,
                            software: serverData.software
                        };
                    } catch (innerError) {
                        console.error(`[ServerManager] Failed to fetch data for server ${server.id}:`, innerError.message);
                        return {
                            id: server.id,
                            name: 'API/Error',
                            status: -1,
                            address: 'unknown',
                            port: 0,
                            players: { count: 0, max: 0, list: [] },
                            software: { name: 'Unknown', version: 'Unknown' }
                        };
                    }
                })
            );

            const primary = statuses[0];

            const backends = statuses.slice(1);

            return {
                ...primary,
                backends: backends
            };

        } catch (error) {
            console.error('[ServerManager] Error fetching server statuses:', error);
            return null;
        }
    }


    /**
     * Dispatches a start command to a specific Exaroton server target by ID.
     * 
     * @param {string} serverId - The target Exaroton server ID.
     * @returns {Promise<boolean>} True if the command was accepted by Exaroton; false otherwise.
     */
    async startServerById(serverId) {
        const targetServer = this.servers.find(server => server.id === serverId);

        if (!targetServer) {
            console.error(`[ServerManager] Cannot start: Server with ID ${serverId} is not configured.`);
            return false;
        }

        try {
            await targetServer.start();
            console.log(`[ServerManager] Start command sent to specific server: ${serverId}`);
            return true;
        } catch (error) {
            console.error(`[ServerManager] Failed to start server ${serverId}:`, error);
            return false;
        }
    }


    /**
     * Dispatches a start command exclusively to the Primary (Proxy) server at Index 0.
     * 
     * @returns {Promise<boolean>} True if the command was accepted; false if empty or failed.
     */
    async startPrimaryServer() {
        if (this.servers.length === 0) return false;

        try {
            await this.servers[0].start();
            console.log('[ServerManager] Start command sent to Primary (Proxy) server.');
            return true;
        } catch (error) {
            console.error('[ServerManager] Failed to start Primary server:', error);
            return false;
        }
    }


    /**
     * Dispatches stop commands concurrently to ALL configured servers.
     * 
     * @returns {Promise<boolean>} True if all stop commands succeeded; false if any single request failed.
     */
    async stopAllServers() {
        if (this.servers.length === 0) return false;

        console.log('[ServerManager] Sending stop command to ALL servers...');

        const results = await Promise.allSettled(this.servers.map(server => server.stop()));

        const failed = results.filter(res => res.status === 'rejected');

        if (failed.length > 0) {
            console.warn(`[ServerManager] Failed to stop ${failed.length} server(s). Check API limits or server states.`);
            return false;
        }

        console.log('[ServerManager] All servers stopped successfully.');
        return true;
    }


    /**
     * Dispatches restart commands concurrently to ALL configured servers.
     * 
     * @returns {Promise<boolean>} True if all restart commands succeeded; false if any single request failed.
     */
    async restartAllServers() {
        if (this.servers.length === 0) return false;

        console.log('[ServerManager] Sending restart command to ALL servers...');

        const results = await Promise.allSettled(this.servers.map(server => server.restart()));

        const failed = results.filter(res => res.status === 'rejected');

        if (failed.length > 0) {
            console.warn(`[ServerManager] Failed to restart ${failed.length} server(s). Check API limits or server states.`);
            return false;
        }

        console.log('[ServerManager] All servers restarted successfully.');
        return true;
    }
}



// Export singleton instance
export const serverManager = new ServerManager();