import { REST, Routes } from 'discord.js';
import { configManager } from '../../config/configManager.js';


import * as setupCommand from '../commands/setup.js';
import * as configCommand from '../commands/config.js';

const commands = [
    setupCommand.data.toJSON(),
    configCommand.data.toJSON()
];

export async function registerCommands() {
    const token = configManager.discordToken;
    if (!token) {
        console.error('[Discord] Cannot register commands: Missing Discord token.');
        return;
    }

    const rest = new REST({ version: '10' }).setToken(token);

    try {
        console.log('[Discord] Started refreshing application (/) commands...');

        const currentUser = await rest.get(Routes.user('@me'));

        await rest.put(
            Routes.applicationCommands(currentUser.id),
            { body: commands },
        );

        console.log('[Discord] Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('[Discord] Failed to register slash commands:', error);
    }
}