import { Client } from "exaroton";

/**
 * @typedef {Object} ServerStatusData
 * @property {string} id - The unique Exaroton server ID.
 * @property {string} name - The display name of the server.
 * @property {number} status - The current status code (e.g., 0 = offline, 1 = online).
 * @property {string} address - The IP address or domain to connect to.
 * @property {number} port - The port to connect to.
 * @property {string} motd - The Message of the Day.
 * @property {Object} players - Information about the current players (count, max, list).
 * @property {Object} software - Information about the server software (name, version).
 * @property {Array<ServerStatusData>} [backends] - Array of backend servers (only present on the primary return object).
 */


/**
 * Manages the connection and commands to the Exaroton API.
 * Supports both Single-Server and Multi-Server (Proxy + Backends) setups.
 */
class ServerManager {
    constructor() {

        /**
         * @type {Client|null} The Exaroton API Client instance.
         */
        this.client = null;

        /**
         * @type {Array<Object>} Array of Exaroton Server objects for executing API commands.
         */
        this.servers = [];

        /**
         * @type {Array<string>} Array of configured Server IDs (Index 0 is always the Primary/Proxy).
         */
        this.serverIds = [];
    }


    /**
     * Initializes the Exaroton API client.
     * 
     * @param {string} apiToken - The secret Exaroton API token.
     * @returns {boolean} True if successfully initialized.
     * @throws {Error} If the API token is missing.
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
     * Sets the target servers to be managed. 
     * The first ID in the array is treated as the Primary (Proxy) server.
     * 
     * @param {string|string[]} serverIds - A single server ID or an array of server IDs.
     * @returns {boolean} True if servers were successfully configured.
     * @throws {Error} If the client was not initialized first.
     */
    setServerTargets(serverIds) {
        if (!this.client) {
            const error = new Error('[ServerManager] Cannot set server targets: Client not initialized.');
            error.code = 'CLIENT_NOT_INTIALIZED';
            throw error;
        }

        const ids = Array.isArray(serverIds)
            ? serverIds.filter(Boolean)
            : (serverIds ? [serverIds] : []);

        this.serverIds = ids;
        this.servers = ids.map(id => this.client.server(id));

        console.log(`[ServerManager] Target servers updated. Monitoring ${this.servers.length} server(s).`);
        if (this.servers.length > 0) {
            console.log(`[ServerManager] Primary (Proxy) Server ID: ${this.serverIds[0]}`);
        }

        return true;
    }


    /**
     * Fetches the status of all configured servers and aggregates the data.
     * Always inherits the primary structure from the first server (Proxy/Main).
     * 
     * @returns {Promise<ServerStatusData|null>} The aggregated server data object, or null if empty/failed.
     */
    async getStatuses() {
        if (this.servers.length === 0) return [];

        try {
            const statuses = await Promise.all(
                this.servers.map(async (server) => {
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
                })
            );

            const primary = statuses[0];

            const backends = statuses.slice(1);

            return {
                ...primary,
                backend: backends
            };

        } catch (error) {
            console.error('[ServerManager] Error fetching server statuses:', error);
            return null;
        }
    }


    /**
     * Sends the start command to a specific server by its Exaroton ID.
     * 
     * @param {string} serverId - The Exaroton ID of the server to start.
     * @returns {Promise<boolean>} True if the command was sent successfully, false otherwise.
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
     * Sends the start command exclusively to the Primary (Proxy) server.
     * 
     * @returns {Promise<boolean>} True if the command was sent successfully, otherwise false.
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
     * Sends the stop command to ALL configured servers simultaneously.
     * 
     * @returns {Promise<boolean>} True if all commands were sent successfully, otherwise false.
     */
    async stopAllServers() {
        if (this.servers.length === 0) return false;

        try {
            await Promise.all(this.servers.map(server => server.stop()));
            console.log('[ServerManager] Stop command sent to ALL servers.');
            return true;
        } catch (error) {
            console.error('[ServerManager] Failed to stop servers:', error);
            return false;
        }
    }


    /**
     * Sends the restart command to ALL configured servers simultaneously.
     * 
     * @returns {Promise<boolean>} True if all commands were sent successfully, otherwise false.
     */
    async restartAllServers() {
        if (this.servers.length === 0) return false;

        try {
            await Promise.all(this.servers.map(server => server.restart()));
            console.log('[ServerManager] Restart command sent to ALL servers.');
            return true;
        } catch (error) {
            console.error('[ServerManager] Failed to restart servers:', error);
            return false;
        }
    }
}



// Export a single instance of the ServerManager (Singleton pattern)
export const serverManager = new ServerManager();