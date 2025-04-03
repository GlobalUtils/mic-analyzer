// js/theme.js
import { saveToLocalStorage, getFromLocalStorage } from './storage.js';
import { DEFAULT_THEME, LOCAL_STORAGE_THEME_KEY } from './config.js';
import { getElement, updateThemeButtonText } from './ui.js';
import { clearVisualizations } from './visualizer.js'; // Import directly if needed

let currentTheme = DEFAULT_THEME;

/**
 * Applies the specified theme to the body and updates the button text.
 * @param {string} themeName - 'light' or 'dark'.
 */
function applyTheme(themeName) {
    const body = document.body;
    body.classList.remove('light-mode', 'dark-mode'); // Remove existing
    body.classList.add(themeName + '-mode');
    currentTheme = themeName;
    updateThemeButtonText(themeName); // Update button text via ui.js
    saveToLocalStorage(LOCAL_STORAGE_THEME_KEY, themeName);

    // Clear canvases to apply new background color immediately
    // This assumes visualizer is either running (will redraw next frame)
    // or stopped (should show correct bg).
    clearVisualizations();
}

/**
 * Toggles between light and dark themes.
 */
export function toggleTheme() {
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    applyTheme(newTheme);
    console.log(`Theme switched to: ${newTheme}`);
}

/**
 * Initializes the theme based on localStorage or default.
 */
export function initTheme() {
    const savedTheme = getFromLocalStorage(LOCAL_STORAGE_THEME_KEY, DEFAULT_THEME);
    applyTheme(savedTheme);
    console.log(`Theme initialized to: ${savedTheme}`);
}
