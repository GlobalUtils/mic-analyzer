// js/i18n.js
import { SUPPORTED_LANGUAGES, DEFAULT_LANG, LOCAL_STORAGE_LANG_KEY } from './config.js';
import { getFromLocalStorage, saveToLocalStorage } from './storage.js';
import { populateLangSelector, uiElements, updateThemeButtonText } from './ui.js'; // Import necessary UI updates

let currentLang = DEFAULT_LANG;
let translations = {}; // Cache for loaded translations: { 'en': {...}, 'es': {...} }

/**
 * Fetches the translation file for a given language.
 * Adjusts fetch path based on current page depth (root vs subdirectory).
 * @param {string} lang - Language code (e.g., 'en', 'es').
 * @returns {Promise<object>} The translation data object.
 */
async function fetchTranslations(lang) {
    // Basic security check for language code
    if (!SUPPORTED_LANGUAGES[lang]) {
        console.warn(`Unsupported language code requested: ${lang}. Falling back to ${DEFAULT_LANG}.`);
        lang = DEFAULT_LANG;
    }
    // Determine base path for locales based on current HTML file location
    const isSubdirectory = window.location.pathname.split('/').filter(Boolean).length > 1; // Simple check if path has more than one segment after domain (e.g., /mic-analyzer/es/)
    const basePath = isSubdirectory ? '../' : ''; // Go up one level if in a subdirectory
    const url = `${basePath}locales/${lang}.json`;

    console.log(`Fetching translations from: ${url}`); // Debugging fetch path

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load translation file for ${lang} from ${url}: ${response.statusText}`);
    }
    return await response.json();
}


/**
 * Loads translations for the specified language into the cache.
 * @param {string} lang - Language code.
 * @returns {Promise<void>}
 */
async function loadTranslations(lang) {
    if (translations[lang]) {
        return; // Already loaded
    }
    try {
        translations[lang] = await fetchTranslations(lang);
        console.log(`Translations loaded for: ${lang}`);
    } catch (error) {
        console.error(`Error loading translations for ${lang}:`, error);
        // Optionally load default language as fallback if primary fails
        if (lang !== DEFAULT_LANG && !translations[DEFAULT_LANG]) {
            try {
                console.log(`Attempting to load fallback language: ${DEFAULT_LANG}`);
                translations[DEFAULT_LANG] = await fetchTranslations(DEFAULT_LANG);
            } catch (fallbackError) {
                console.error(`Failed to load fallback language ${DEFAULT_LANG}:`, fallbackError);
                // If even default fails, we might be stuck or need a hardcoded minimal set
                translations[lang] = {}; // Store empty object to prevent repeated attempts
            }
        } else if (lang !== DEFAULT_LANG) {
             translations[lang] = translations[DEFAULT_LANG] || {}; // Use default if already loaded
        } else {
             translations[lang] = {}; // Default failed, store empty
        }
    }
}

/**
 * Gets a translation string for a given key, performing replacements.
 * Falls back to the key itself or default language if translation is missing.
 * @param {string} key - The translation key (e.g., 'appTitle').
 * @param {object} [replacements] - Key-value pairs for placeholders (e.g., { count: 5 }).
 * @returns {string} The translated (and interpolated) string.
 */
export function t(key, replacements = {}) {
    let langData = translations[currentLang] || translations[DEFAULT_LANG] || {};
    let text = langData[key] || key; // Fallback to key name if not found

    // Simple placeholder replacement (e.g., "Hello {name}")
    for (const [placeholder, value] of Object.entries(replacements)) {
        const regex = new RegExp(`\\{${placeholder}\\}`, 'g');
        text = text.replace(regex, value);
    }
    return text;
}

/**
 * Applies the currently loaded translations to all elements with data-i18n attributes.
 */
function applyTranslationsToDOM() {
    console.log(`Applying translations for: ${currentLang}`);
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const attr = element.getAttribute('data-i18n-attr') || 'textContent'; // Default to textContent
        const translation = t(key);

        if (translation !== key || attr !== 'textContent') { // Apply if translation found or attribute specified
             if (attr === 'textContent') {
                 element.textContent = translation;
             } else if (attr === 'title') {
                 element.title = translation;
             } else if (attr === 'placeholder') {
                 element.placeholder = translation;
             } else if (attr === 'content' && element.tagName === 'META') { // Handle meta tags
                 element.setAttribute('content', translation);
             }
              else {
                 // Handle other attributes if needed
                 element.setAttribute(attr, translation);
             }
        } else {
            // console.warn(`Translation missing for key: ${key} in lang: ${currentLang}`);
        }
    });

    // Set document language and direction (already set in HTML, but good practice)
    document.documentElement.lang = currentLang;
    document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr'; // Basic RTL support

    // Explicitly update elements not covered by data-i18n loop if needed
    // Example: Update theme button text based on current theme AND language
    const currentTheme = document.body.classList.contains('light-mode') ? 'light' : 'dark';
    updateThemeButtonText(currentTheme, t); // Pass translation function

    // Update dynamic button texts if needed (e.g., if monitoring/recording state changes require text update)
    // This might be better handled within the state update functions themselves, passing `t`
}

/**
 * Sets the current language state *locally* (used primarily for initial load).
 * Navigation is handled separately by the event listener.
 * @param {string} lang - The language code.
 */
async function setInternalLanguageState(lang) {
    if (!SUPPORTED_LANGUAGES[lang]) {
        console.warn(`Attempted to set unsupported language internally: ${lang}. Using ${DEFAULT_LANG}.`);
        lang = DEFAULT_LANG;
    }
    currentLang = lang;
    await loadTranslations(lang); // Ensure translations are loaded for the current page
    applyTranslationsToDOM();
    saveToLocalStorage(LOCAL_STORAGE_LANG_KEY, lang); // Still useful for remembering preference if user navigates away and back
    // Update the language selector dropdown to reflect the current page's language
    const langSelect = uiElements.langSelect();
    if (langSelect) langSelect.value = lang;
}


/**
 * Initializes internationalization: detects language, loads translations, sets up switcher.
 */
export async function initI18n() {
    // --- Step 2 Modification: Initial Language Detection ---
    // 1. Prioritize data-lang attribute from HTML
    let initialLang = document.documentElement.getAttribute('data-lang');
    console.log(`Detected data-lang: ${initialLang}`);

    if (!initialLang || !SUPPORTED_LANGUAGES[initialLang]) {
        console.log(`data-lang invalid or missing. Falling back...`);
        // 2. Fallback to localStorage
        initialLang = getFromLocalStorage(LOCAL_STORAGE_LANG_KEY);
        if (!initialLang || !SUPPORTED_LANGUAGES[initialLang]) {
            console.log(`localStorage lang invalid or missing. Falling back to browser lang...`);
            // 3. Fallback to browser preference
            const browserLang = navigator.language.split('-')[0]; // Get 'en' from 'en-US'
            initialLang = SUPPORTED_LANGUAGES[browserLang] ? browserLang : DEFAULT_LANG;
            console.log(`Using browser/default lang: ${initialLang}`);
        } else {
             console.log(`Using localStorage lang: ${initialLang}`);
        }
    }
    // --- End Step 2 Modification ---

    // Set the internal state based on the determined language for *this* page
    await setInternalLanguageState(initialLang);

    // Populate the language selector dropdown
    populateLangSelector(currentLang, t); // Populate selector using loaded translations

    // --- Step 3 Modification: Language Switching Navigation ---
    const langSelect = uiElements.langSelect();
    if (langSelect) {
        langSelect.addEventListener('change', (event) => {
            const selectedLang = event.target.value;
            let targetPath;

            // Construct the target *path* based on the selected language
            // Assuming deployment is at 'https://<domain>/mic-analyzer/'
            const basePath = '/mic-analyzer'; // Adjust if your repo name or deployment path changes

            if (selectedLang === 'en') { // Assuming 'en' is the root
                targetPath = `${basePath}/`;
            } else if (SUPPORTED_LANGUAGES[selectedLang]) {
                targetPath = `${basePath}/${selectedLang}/`;
            } else {
                console.warn(`Invalid language selected: ${selectedLang}`);
                return; // Don't navigate if language is somehow invalid
            }

            // Get current path, ensuring it ends with a slash for comparison consistency
            let currentPath = window.location.pathname;
            if (!currentPath.endsWith('/')) {
                currentPath += '/';
            }

            // Navigate the browser only if the target path is different
            if (currentPath !== targetPath) {
                 console.log(`Navigating from ${currentPath} to ${targetPath}`);
                 window.location.href = targetPath; // Use relative path for navigation
            } else {
                 console.log(`Already on the correct page for language: ${selectedLang}`);
            }
        });
    }
    // --- End Step 3 Modification ---

    console.log(`i18n initialized with language: ${currentLang}`);
}
