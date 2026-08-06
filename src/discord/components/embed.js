import { EmbedBuilder } from 'discord.js';


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

    // Exaroton Status Codes: 0 = Offline, 1 = Online, 2 = Starting, 3 = Stopping
    const statusMap = {
        0: { name: '🔴 Offline', color: 0xe74c3c },     // Red
        1: { name: '🟢 Online', color: 0x2ecc71 },      // Green
        2: { name: '🟡 Starting...', color: 0xf1c40f }, // Yellow
        3: { name: '🟠 Stopping...', color: 0xe67e22 }   // Orange
    };

    const currentStatus = statusMap[serverData.status] || { name: '❓ Unknown', color: 0x95a5a6 };

    embed.setTitle(`🎮 ${serverData.name || 'Minecraft Server'}`)
         .setColor(currentStatus.color)
         .addFields(
             { name: 'Status', value: currentStatus.name, inline: true },
             { name: 'IP Address', value: serverData.address ? `\`${serverData.address}:${serverData.port}\`` : '*Not available*', inline: true },
             { name: 'Players', value: serverData.players ? `${serverData.players.count} / ${serverData.players.max}` : '0 / 0', inline: true }
         );

    const hasBackends = serverData.backends && serverData.backends.length > 0;

    // Software/Version ONLY if there are NO backends (Single Server / Primary is the game server)
    if (!hasBackends && serverData.software) {
        embed.addFields({ 
            name: 'Software', 
            value: `${serverData.software.name} ${serverData.software.version}`, 
            inline: true 
        });
    }

    // If backends are present (Multi-Server / Proxy Setup), show version per backend
    if (hasBackends) {
        const backendList = serverData.backends.map(b => {
            const bStatus = b.status === 1 ? '🟢' : (b.status === 2 ? '🟡' : '🔴');
            const bVersion = b.software ? ` *(${b.software.name} ${b.software.version})*` : '';
            return `${bStatus} **${b.name}**${bVersion}`;
        }).join('\n');

        embed.addFields({ name: `🧱 Backend Servers (${serverData.backends.length})`, value: backendList, inline: false });
    }

    // MOTD (Message of the Day) if available
    if (serverData.motd) {
        const cleanMotd = serverData.motd.replace(/§[0-9a-fk-or]/g, '');
        embed.setDescription(`> *${cleanMotd}*`);
    }

    embed.setTimestamp();
    return embed;
}