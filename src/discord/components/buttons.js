import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';


/**
 * Exaroton Server Status Code Mapping:
 * 0 = Offline, 1 = Online, 2 = Starting, 3 = Stopping, 4 = Restarting,
 * 5 = Saving, 6 = Loading, 7 = Crashed, 8 = Pending, 9 = Transferring, 10 = Preparing
 */

/**
 * Creates and configures interactive Discord action row buttons dynamically
 * based on the current Exaroton server lifecycle status.
 *
 * - **Offline (0) / Crashed (7):** Renders active 'Start' button.
 * - **Online (1):** Renders active 'Stop' and 'Restart' buttons.
 * - **Transitional States (2-6, 8-10):** Renders disabled 'Start', 'Stop', and 'Restart' buttons.
 * - **Fallback:** Renders enabled 'Start', 'Stop', and 'Restart' buttons.
 * 
 * @param {number} [serverStatus=0] - Exaroton status code representing state. Defaults to 0 (Offline).
 * @returns {ActionRowBuilder<ButtonBuilder>} An ActionRow containing configured ButtonBuilder components.
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
        
        case -1: // API Error
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
            
        default: // Fallback for unknown status codes
            row.addComponents(startButton, stopButton, restartButton);
            break;
    }

    return row;
}