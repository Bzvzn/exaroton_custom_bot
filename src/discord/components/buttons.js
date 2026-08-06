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

    const stopButton = new ButtonBuilder()
        .setCustomId('server_stop')
        .setLabel('Stop')
        .setStyle(ButtonStyle.Danger)

    const restartButton = new ButtonBuilder()
        .setCustomId('server_restart')
        .setLabel('Restart')
        .setStyle(ButtonStyle.Secondary)

    switch (serverStatus) {
        case 0: // Offline
        case 7: // Crashed
            row.addComponents(startButton);
            break;
            
        case 1: // Online
            row.addComponents(stopButton, restartButton);
            break;
            
        case 2: // Starting
        case 3: // Stopping
        case 4: // Restarting
        case 5: // Saving
        case 6: //Loading
        case 8: //Pending
        case 9: //Transferring
        case 10: // Preparing
            startButton.setDisabled(true);
            stopButton.setDisabled(true);
            restartButton.setDisabled(true);
            
            row.addComponents(startButton, stopButton, restartButton);
            break;
            
        default: // Fallback
            row.addComponents(startButton, stopButton, restartButton);
            break;
    }

    return row;
}