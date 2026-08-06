import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

/**
 * Creates the interactive control buttons based on the current server status.
 * 
 * @param {number} [serverStatus=0] - Exaroton status code (0 = Offline, 1 = Online, 2 = Starting, 3 = Stopping)
 * @returns {ActionRowBuilder} The action row containing only the relevant buttons.
 */
export function createControlButtons(serverStatus = 0) {
    const row = new ActionRowBuilder();

    const startButton = new ButtonBuilder()
        .setCustomId('server_start')
        .setLabel('Start')
        .setStyle(ButtonStyle.Success)
        .setEmoji('▶️');

    const stopButton = new ButtonBuilder()
        .setCustomId('server_stop')
        .setLabel('Stop')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('⏹️');

    const restartButton = new ButtonBuilder()
        .setCustomId('server_restart')
        .setLabel('Restart')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔄');

    // Exaroton Status Codes: 0 = Offline, 1 = Online, 2 = Starting, 3 = Stopping
    switch (serverStatus) {
        case 0:
            row.addComponents(startButton);
            break;
            
        case 1:
            row.addComponents(stopButton, restartButton);
            break;
            
        case 2: 
        case 3: 
            row.addComponents(stopButton);
            break;
            
        default: // Fallback
            row.addComponents(startButton, stopButton, restartButton);
            break;
    }

    return row;
}