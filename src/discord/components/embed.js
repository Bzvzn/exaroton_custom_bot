import { EmbedBuilder } from 'discord.js';
import { configManager } from '../../config/configManager.js';

/**
 * @typedef {Object} ServerSoftware
 * @property {string} name - Name of the server software (e.g., Paper, Velocity, Fabric).
 * @property {string} version - Version string of the server software (e.g., 1.20.4).
 */

/**
 * @typedef {Object} PlayerData
 * @property {number} count - Current online player count.
 * @property {number} max - Maximum player capacity.
 */

/**
 * @typedef {Object} BackendServerData
 * @property {string} name - Display name of the backend server.
 * @property {number} status - Exaroton status code of the backend server.
 * @property {ServerSoftware} [software] - Software details of the backend server.
 */

/**
 * @typedef {Object} ServerData
 * @property {number} status - Exaroton status code of the primary/proxy server.
 * @property {string} [address] - IP address or hostname of the server.
 * @property {number|string} [port] - Server connection port.
 * @property {PlayerData} [players] - Player count details.
 * @property {ServerSoftware} [software] - Primary server software details (used in single-server setups).
 * @property {BackendServerData[]} [backends] - List of linked backend server objects (used in proxy setups).
 * @property {string} [motd] - Clean or raw Message of the Day string.
 */


/**
 * Constructs a rich Discord embed displaying real-time Minecraft server details.
 * Dynamically adjusts fields based on single-server vs. multi-server/proxy topologies
 * and reflects global maintenance mode status when enabled.
 * 
 * @param {ServerData|null} serverData - Aggregated server status object from ServerManager, or null if unconfigured.
 * @returns {EmbedBuilder} A fully configured Discord EmbedBuilder instance.
 */
export function createStatusEmbed(serverData) {
    const embed = new EmbedBuilder();

    // Fallback state when no server targets are configured or data fetching failed
    if (!serverData) {
        return embed
            .setTitle('⚙️ Minecraft Server Status')
            .setDescription('No servers configured or connection failed.\nUse `/config` to add servers.')
            .setColor(0x95a5a6); // Gray
    }

    const statusMap = {
        0:  { name: '🔴 Offline', color: 0xe74c3c },       // Red
        1:  { name: '🟢 Online', color: 0x2ecc71 },        // Green
        2:  { name: '🟡 Starting...', color: 0xf1c40f },   // Yellow
        3:  { name: '🟠 Stopping...', color: 0xe67e22 },   // Orange
        4:  { name: '🔄 Restarting...', color: 0x3498db }, // Blue
        5:  { name: '💾 Saving...', color: 0xf39c12 },     // Dark Orange
        6:  { name: '⏳ Loading...', color: 0xf1c40f },    // Yellow
        7:  { name: '💥 Crashed', color: 0x992d22 },       // Dark Red
        8:  { name: '⌛ Pending...', color: 0x95a5a6 },    // Gray
        9:  { name: '📦 Transferring...', color: 0x9b59b6 }, // Purple
        10: { name: '🛠️ Preparing...', color: 0x34495e }    // Dark Blue
    };

    const currentStatus = statusMap[serverData.status] || { name: '❓ Unknown', color: 0x95a5a6 };

    embed.setTitle('⚙️ Minecraft Server Status')
         .setColor(currentStatus.color)
         .addFields(
             { name: 'Status', value: currentStatus.name, inline: true },
             { name: 'IP Address', value: serverData.address ? `\`${serverData.address}\`` : '*Not available*', inline: true },
             { name: 'Port', value: serverData.port ? `\`${serverData.port}\`` : '*Not available*', inline: true },
             { name: 'Players', value: serverData.players ? `${serverData.players.count} / ${serverData.players.max}` : '0 / 0', inline: true }
         );

    const hasBackends = serverData.backends && serverData.backends.length > 0;

    // Display software version only if there are no backends (standalone primary game server)
    if (!hasBackends && serverData.software) {
        embed.addFields({ 
            name: 'Software Version', 
            value: `${serverData.software.name} ${serverData.software.version}`, 
            inline: true 
        });
    }

    // Display list of backend servers with status indicators if proxy setup is active
    if (hasBackends) {
        const backendList = serverData.backends.map(b => {
            let bStatusEmoji = '🟡'; 
            if (b.status === 1) bStatusEmoji = '🟢';
            if (b.status === 0 || b.status === 7) bStatusEmoji = '🔴';
            
            const bVersion = b.software ? ` *(${b.software.name} ${b.software.version})*` : '';
            return `${bStatusEmoji} **${b.name}**${bVersion}`;
        }).join('\n');

        embed.addFields({ name: `🧱 Backend Servers (${serverData.backends.length})`, value: backendList, inline: false });
    }

    const isMaintenance = configManager.isMaintenanceMode();
    let descriptionText = '';

    if (isMaintenance) {
        
        descriptionText += '🚧 **Maintenance mode active!**\n*The server is currently being configured. Bot controls are temporarily disabled.*\n\n';

        embed.setColor(0xe67e22); // Orange override during maintenance
    }

    // Parse and append MOTD (Message of the Day), stripping Minecraft formatting codes (§a, §l, etc.)
    if (serverData.motd) {
        const cleanMotd = serverData.motd.replace(/§[0-9a-fk-or]/g, '');
        embed.setDescription(`> *${cleanMotd}*`);
    }

    if (descriptionText) {
        embed.setDescription(descriptionText);
    }

    embed.setTimestamp();
    return embed;
}