import { REST, Routes } from 'discord.js';
import { configManager } from '../../config/configManager.js';


import * as setupCommand from '../commands/setup.js';
import * as configCommand from '../commands/config.js';


/**
 * Array of serialized JSON payloads representing all application slash command definitions.
 * @type {Object[]}
 */
const commands = [
    setupCommand.data.toJSON(),
    configCommand.data.toJSON()
];


/**
 * Registers global application (/) slash commands with the Discord REST API (v10).
 * Fetches the bot application client ID dynamically (`Routes.user('@me')`) and updates command definitions.
 * 
 * @returns {Promise<void>} Resolves when application command registration finishes or aborts due to missing tokens.
 * @throws {Error} Logs errors encountered during REST API requests (e.g., unauthorized token or rate limits).
 */
export async function registerCommands() {
    const token = configManager.discordToken;
    if (!token) {
        console.error('[Discord] Cannot register commands: Missing Discord token.');
        return;
    }

    const rest = new REST({ version: '10' }).setToken(token);

    try {
        console.log('[Discord] Started refreshing application (/) commands...');

        // Retrieve current application user object to obtain client application ID dynamically
        const currentUser = await rest.get(Routes.user('@me'));

        // Overwrite global application commands for this client ID
        await rest.put(
            Routes.applicationCommands(currentUser.id),
            { body: commands },
        );

        console.log('[Discord] Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('[Discord] Failed to register slash commands:', error);
    }
}