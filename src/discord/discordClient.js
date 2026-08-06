import { Client, GatewayIntentBits, Events } from 'discord.js';
import { configManager } from '../config/configManager.js';
import { serverManager } from '../services/serverManager.js';


export const discordClient = new Client({
    intents: [GatewayIntentBits.Guilds] 
});


export async function startDiscordBot() {

    // ==========================================
    // 1. Connection to exaroton
    // ==========================================
    serverManager.on('statusUpdate', async (serverId, newStatus) => {
        console.log(`[Discord Event] Server ${serverId} changed status to ${newStatus}`);
        
        const setupData = configManager.getDiscordSetup();
        if (!setupData) return;

        try {
            // Hier updaten wir später das Embed! 
            // (Die Funktion dafür schreiben wir im nächsten Schritt)
            // await updateStatusEmbed(discordClient, setupData);
        } catch (error) {
            console.error('[Discord] Failed to update status embed:', error);
        }
    });

    // ==========================================
    // 2. DISCORD EVENTS (Ready & Interactions)
    // ==========================================
    discordClient.once(Events.ClientReady, (readyClient) => {
        console.log(`[Discord] Bot is online and logged in as ${readyClient.user.tag}!`);
        // Später laden wir hier unsere Slash-Commands (/setup, /config) hoch
    });

    discordClient.on(Events.InteractionCreate, async (interaction) => {
        // Hier leiten wir später Slash-Commands und Button-Klicks weiter
    });


    // ==========================================
    // 3. LOGIN
    // ==========================================
    try {
        await discordClient.login(configManager.discordToken);
        return true;
    } catch (error) {
        const error = new Error('[Discord] FATAL ERROR: Failed to login. Check your DISCORD_TOKEN.');
        error.code = 'DISCORD_FAIL';
        throw error;
    }
}