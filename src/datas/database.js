import Database from "better-sqlite3";
import fs from 'fs';
import path from "path";
import { fileURLToPath } from 'url';


/**
 * Manages the SQLite database connection and provides a Key-Value store 
 * for dynamic bot configuration and settings.
 */
class DatabaseManager {
    constructor() {
        /**
         * @type {Database.Database|null} The active SQLite database instance.
         */
        this.db = null;
    }


    /**
     * Initializes the database connection, ensures the directory exists, 
     * applies optimal Pragmas, and creates the settings table.
     * 
     * @param {string|null} [customPath=null] - Optional absolute path for the .db file. Defaults to '../../data/main.db'.
     * @throws {Error} If the database connection fails.
     */
    init(customPath = null) {
        const currentDir = path.dirname(fileURLToPath(import.meta.url));

        const dbPath = customPath || path.resolve(currentDir, '../../data/main.db');

        try {
            if (dbPath !== ':memory:') {
                const dbDir = path.dirname(dbPath);
                if (!fs.existsSync(dbDir)) {
                    fs.mkdirSync(dbDir, { recursive: true });
                }
            }

            this.db = new Database(dbPath);

            this.db.pragma('journal_mode = WAL');
            this.db.pragma('busy_timeout = 5000');
            this.db.pragma('cache_size = -16000'); // 16 MB
            this.db.pragma('synchronous = FULL');


            console.log('[Database] SQLite connected successfully.');


            this.db.prepare(`
            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        `).run();
        } catch (error) {
            console.error('[DatabaseManager] Failed to initialize database:', error);
            error.code = 'DB_INIT_ERROR';
            throw error;
        }
    }


    /**
     * Retrieves a stored setting from the database and parses it from JSON.
     * 
     * @param {string} key - The unique identifier/name of the setting.
     * @returns {any|null} The parsed setting value, or null if it doesn't exist or an error occurs.
     */
    getSetting(key) {
        if (!this.db) return null;

        try {
            const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
            if (row) {
                return JSON.parse(row.value);
            }
        } catch (error) {
            console.error(`[Database] Error reading key '${key}':`, error);
        }
        return null;
    }


    /**
     * Inserts or updates a single setting in the database using a transaction.
     * The value is automatically stringified to JSON.
     * 
     * @param {string} key - The unique identifier/name of the setting.
     * @param {any} value - The data to store (must be JSON serializable).
     * @returns {boolean} True if the save was successful, false otherwise.
     */
    setSetting(key, value) {
        if (!this.db) return false;

        const stmt = this.db.prepare(`
            INSERT INTO settings (key, value) 
            VALUES (?, ?) 
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `);

        const transaction = this.db.transaction((k, v) => {
            stmt.run(k, v);
        });

        try {
            transaction(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`[Database] Transaction failed for key '${key}':`, error);
            return false;
        }
    }


    /**
     * Inserts or updates multiple settings at once using a bulk transaction.
     * If one fails, the entire transaction is rolled back.
     * 
     * @param {Array<{key: string, value: any}>} settingsArray - Array of setting objects to store.
     * @returns {boolean} True if all settings were saved successfully, false if the transaction rolled back.
     */
    setMultipleSettings(settingsArray) {
        if (!this.db) return false;

        const stmt = this.db.prepare(`
            INSERT INTO settings (key, value) 
            VALUES (?, ?) 
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `);

        const transaction = this.db.transaction((settings) => {
            for (const item of settings) {
                stmt.run(item.key, JSON.stringify(item.value));
            }
        });

        try {
            transaction(settingsArray);
            return true;
        } catch (error) {
            console.error('[Database] Bulk transaction failed, rolling back changes:', error);
            return false;
        }
    }


    /**
     * Safely closes the database connection.
     * Should be called during the Node.js graceful shutdown process.
     */
    close() {
        if (this.db) {
            try {
                this.db.close();
                console.log('[Database] SQLite connection closed gracefully.');
                this.db = null;
            } catch (error) {
                console.error('[Database] Error while closing the database:', error);
            }
        }
    }
}


export const database = new DatabaseManager();