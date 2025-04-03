// js/storage.js

/**
 * Saves a key-value pair to localStorage.
 * @param {string} key - The key to save.
 * @param {string} value - The value to save.
 */
export function saveToLocalStorage(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (e) {
        console.error(`Error saving to localStorage (${key}):`, e);
        // Handle potential storage quota errors or security restrictions
    }
}

/**
 * Retrieves a value from localStorage.
 * @param {string} key - The key to retrieve.
 * @param {string | null} defaultValue - The value to return if the key is not found.
 * @returns {string | null} The retrieved value or the default value.
 */
export function getFromLocalStorage(key, defaultValue = null) {
    try {
        const value = localStorage.getItem(key);
        return value === null ? defaultValue : value;
    } catch (e) {
        console.error(`Error reading from localStorage (${key}):`, e);
        return defaultValue; // Return default on error
    }
}
