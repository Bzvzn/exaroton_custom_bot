import { database } from './datas/database.js';
import { configManager } from './config/configManager.js';
import { serverManager } from './services/serverManager.js';
import { startDiscordBot, stopDiscordBot } from './discord/discordClient.js';
import { startTwitchBot, stopTwitchBot } from './twitch/twitchClient.js';


/**
 * Main application bootstrap function.
 * Orchestrates step-by-step startup sequence:
 * 1. Initializes SQLite persistence database.
 * 2. Loads and validates environment variables and static configurations.
 * 3. Initializes Exaroton API client and binds saved server target IDs.
 * 4. Launches Discord bot client and deploys slash commands.
 * 5. Connects Twitch chat client if a channel is configured.
 * 
 * @async
 * @function bootstrap
 * @returns {Promise<void>} Resolves when all sub-services have successfully initialized.
 * @throws {Error} Catches fatal startup errors, logs details, and triggers immediate process exit (`shutdown(1)`).
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
        shutdown(1); // Exit process with failure code
    }
}


/**
 * Handles graceful shutdown sequence for the application.
 * Safely disconnects Discord and Twitch clients and flushes/closes SQLite database connections.
 * 
 * @async
 * @function shutdown
 * @param {number} [code=0] - Exit status code passed to `process.exit()` (0 = normal termination, 1 = error exit).
 * @returns {Promise<never>} Terminates Node.js execution.
 */
async function shutdown(code = 0) {
    console.log('\n[System] Initiating graceful shutdown...');

    await stopDiscordBot();
    await stopTwitchBot();

    database.close();

    console.log('[System] Shutdown complete. Goodbye!');
    process.exit(code);
}


/**
 * Process event listener for OS interrupt signals (e.g., Ctrl+C in console).
 * Triggers graceful shutdown with exit code 0.
 */
process.on('SIGINT', () => shutdown(0));


/**
 * Process event listener for termination signals (e.g., PM2 stop/restart or system daemon termination).
 * Triggers graceful shutdown with exit code 0.
 */
process.on('SIGTERM', () => shutdown(0));


/**
 * Global exception handler for unhandled synchronous errors.
 * Logs error details to console and triggers forced teardown with exit code 1.
 */
process.on('uncaughtException', (error) => {
    console.error('[System] Uncaught Exception:', error);
    shutdown(1);
});


/**
 * Global rejection handler for unhandled asynchronous promise rejections.
 * Logs target promise and rejection reason for diagnostic debugging.
 */
process.on('unhandledRejection', (reason, promise) => {
    console.error('[System] Unhandled Promise Rejection at:', promise, 'reason:', reason);
});


// Execute entry point
bootstrap();