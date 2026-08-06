import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

/**
 * Creates the interactive control buttons (Start, Stop, Restart).
 * 
 * @returns {ActionRowBuilder} The action row containing the buttons.
 */
export function createControlButtons() {
    const startButton = new ButtonBuilder()
        .setCustomId('server_start')
        .setLabel('Start')
        .setStyle(ButtonStyle.Success) // Green
        .setEmoji('▶️');

    const stopButton = new ButtonBuilder()
        .setCustomId('server_stop')
        .setLabel('Stop')
        .setStyle(ButtonStyle.Danger)  // Red
        .setEmoji('⏹️');

    const restartButton = new ButtonBuilder()
        .setCustomId('server_restart')
        .setLabel('Restart')
        .setStyle(ButtonStyle.Secondary) // Gray
        .setEmoji('🔄');

    return new ActionRowBuilder().addComponents(startButton, stopButton, restartButton);
}