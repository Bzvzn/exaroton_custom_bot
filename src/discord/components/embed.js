import { EmbedBuilder } from 'discord.js';
import { configManager } from '../../config/configManager.js';


/**
 * Creates the server status embed based on the current Exaroton data.
 * 
 * @param {Object|null} serverData - The aggregated server data from ServerManager.
 * @returns {EmbedBuilder} The configured Discord embed.
 */
export function createStatusEmbed(serverData) {
    const embed = new EmbedBuilder();

    // 1. Fall: No servers configured
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

    // Software/Version ONLY if there are NO backends (Single Server / Primary is the game server)
    if (!hasBackends && serverData.software) {
        embed.addFields({ 
            name: 'Software Version', 
            value: `${serverData.software.name} ${serverData.software.version}`, 
            inline: true 
        });
    }

    // If backends are present (Multi-Server / Proxy Setup), show version per backend
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

        embed.setColor(0xe67e22); 
    }

    // MOTD (Message of the Day) if available
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