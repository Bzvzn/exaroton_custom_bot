import { database } from './datas/database.js';
import { configManager } from './config/configManager.js';
import { serverManager } from './services/serverManager.js';
import { discordClient, startDiscordBot, stopDiscordBot } from './discord/discordClient.js';
import { startTwitchBot, stopTwitchBot } from './twitch/twitchClient.js';

/**
 * The main entry point of the application.
 * Initializes all services in the correct order.
 */
async function bootstrap() {
    try {
        console.log('====================================');
        console.log('      Starting Server-Bot...        ');
        console.log('====================================');

        // 1. Initialize SQLite Database
        database.init();

        // 2. Initialize Configurations (.env & config.json)
        configManager.init();

        // 3. Initialize the Exaroton API Client
        serverManager.init(configManager.exarotonToken);

        // 4. Load saved Server IDs from the database
        const serverIds = configManager.getServerIds();
        if (serverIds.length > 0) {
            serverManager.setServerTargets(serverIds);
        } else {
            console.log('[Bootstrap] No Exaroton servers configured yet. You can set them up via Discord later.');
        }

        // 5. Start the Discord Bot
        console.log('[Bootstrap] Starting Discord Bot...');
        await startDiscordBot();

        // 6. Start the Twitch Bot
        console.log('[Bootstrap] Starting Twitch Bot...');
        await startTwitchBot();


        console.log('====================================');
        console.log('   Bot successfully initialized!    ');
        console.log('====================================');

    } catch (error) {
        console.error('[Bootstrap] FATAL ERROR during startup:', error);
        shutdown(1); // Beendet das Programm mit einem Fehlercode
    }
}


/**
 * Handles graceful shutdown of all services.
 * Ensures data is saved and connections are closed properly.
 * 
 * @param {number} code - The exit code (0 for success, 1 for error).
 */
async function shutdown(code = 0) {
    console.log('\n[System] Initiating graceful shutdown...');

    await stopDiscordBot();
    await stopTwitchBot();

    database.close();

    console.log('[System] Shutdown complete. Goodbye!');
    process.exit(code);
}


process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));


process.on('uncaughtException', (error) => {
    console.error('[System] Uncaught Exception:', error);
    shutdown(1);
});

// Start the application
bootstrap();