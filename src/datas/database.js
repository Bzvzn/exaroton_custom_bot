import Database from "better-sqlite3";
import fs from 'fs';
import path from "path";
import { fileURLToPath } from 'url';

/**
 * @typedef {Object} SettingItem
 * @property {string} key - Unique identifier for the setting.
 * @property {*} value - Value to be stored (must be JSON-serializable).
 */


/**
 * Key-Value store manager powered by SQLite (`better-sqlite3`).
 * Provides high-performance persistence for dynamic bot configurations and settings.
 */
class DatabaseManager {

    /**
     * Instantiates the DatabaseManager.
     * Sets the initial active database instance reference to null.
     */
    constructor() {
        /**
         * The active SQLite database connection instance.
         * @type {Database.Database|null}
         */
        this.db = null;
    }


    /**
     * Initializes the SQLite database connection.
     * Ensures target directory existence, configures WAL mode and performance Pragmas,
     * and sets up the primary Key-Value table structure.
     * 
     * @param {string|null} [customPath=null] - Absolute path for the .db file. Defaults to '../../data/main.db'.
     * @returns {void}
     * @throws {Error} Throws an error with code 'DB_INIT_ERROR' if connection or initialization fails.
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
            this.db.pragma('synchronous = NORMAL');


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
     * Retrieves and parses a stored setting by its unique key.
     * 
     * @template T
     * @param {string} key - Unique key identifier of the setting.
     * @returns {T|null} The parsed JSON value of the setting, or null if uninitialized, missing, or corrupt.
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
     * Inserts or updates a single setting within an atomic SQLite transaction.
     * Serializes the value parameter to JSON before persisting.
     * 
     * @param {string} key - Unique key identifier for the setting.
     * @param {*} value - Data payload to store (must be JSON-serializable).
     * @returns {boolean} True if successfully committed; false if database is uninitialized or write fails.
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
     * Inserts or updates multiple settings atomically using a bulk transaction.
     * If any single operation fails, the entire transaction is rolled back.
     * 
     * @param {SettingItem[]} settingsArray - Array of setting objects containing key and value properties.
     * @returns {boolean} True if all items were committed; false if database is uninitialized or transaction rolled back.
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
     * Gracefully closes the active SQLite database connection.
     * Should be integrated into process exit signals (SIGINT, SIGTERM) during teardown.
     * 
     * @returns {void}
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


// Export singleton instance
export const database = new DatabaseManager();