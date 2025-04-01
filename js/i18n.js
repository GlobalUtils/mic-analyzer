// js/i18n.js

(function(window) {
    'use strict';

    // --- Module Configuration ---
    const defaultLanguage = 'en';
    // Define supported languages here. The key is the language code (used in paths and filenames),
    // the value is the native name for the language selector.
    const supportedLanguages = {
        'en': 'English',
        // 'es': 'Español', // Example: Add more languages here
        // 'fr': 'Français', // Example: Add more languages here
    };
    const localesPath = 'locales'; // Relative path to translation files
    const localStorageKey = 'preferredLanguage';

    // --- Module State ---
    let currentLanguage = defaultLanguage;
    let translations = {}; // Stores the loaded translations for the current language

    // --- Core Functions ---

    /**
     * Detects the preferred language based on URL path, localStorage, or browser settings.
     * @returns {string} The detected language code.
     */
    const detectLanguage = () => {
        console.log("Detecting language...");
        // 1. Check URL Path (e.g., /es/, /fr/)
        const pathSegments = window.location.pathname.split('/').filter(segment => segment);
        // Assumes language code is the first segment if present (e.g., site.com/es/...)
        // Adjust index if your structure is different (e.g., site.com/mic-analyzer/es/)
        const urlLang = pathSegments[0]; // Or pathSegments[1] depending on base path

        if (urlLang && supportedLanguages.hasOwnProperty(urlLang)) {
            console.log(`Language detected from URL: ${urlLang}`);
            return urlLang;
        }

        // 2. Check localStorage
        const storedLang = localStorage.getItem(localStorageKey);
        if (storedLang && supportedLanguages.hasOwnProperty(storedLang)) {
            console.log(`Language detected from localStorage: ${storedLang}`);
            return storedLang;
        }

        // 3. Check Browser Settings (navigator.language)
        const browserLang = navigator.language.split('-')[0]; // Get primary language code (e.g., 'en' from 'en-US')
        if (browserLang && supportedLanguages.hasOwnProperty(browserLang)) {
            console.log(`Language detected from browser: ${browserLang}`);
            return browserLang;
        }

        // 4. Fallback to Default
        console.log(`Falling back to default language: ${defaultLanguage}`);
        return defaultLanguage;
    };

    /**
     * Fetches and loads the translation file for the given language.
     * @param {string} lang - The language code (e.g., 'en', 'es').
     * @returns {Promise<object>} A promise that resolves with the translation object.
     */
    const loadTranslations = async (lang) => {
        if (!supportedLanguages.hasOwnProperty(lang)) {
            console.error(`Language "${lang}" is not supported. Falling back to ${defaultLanguage}.`);
            lang = defaultLanguage;
        }

        const filePath = `${localesPath}/${lang}.json`;
        console.log(`Loading translations from: ${filePath}`);

        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status} for ${filePath}`);
            }
            const data = await response.json();
            translations = data; // Store loaded translations
            console.log(`Translations loaded successfully for "${lang}".`);
            return translations;
        } catch (error) {
            console.error(`Failed to load translations for "${lang}":`, error);
            // Optionally load default language as fallback on error
            if (lang !== defaultLanguage) {
                console.warn(`Attempting to load default language "${defaultLanguage}" as fallback.`);
                return loadTranslations(defaultLanguage);
            } else {
                // If even default fails, return empty object or re-throw
                translations = {}; // Reset translations
                throw new Error(`Failed to load default translations (${defaultLanguage}).`);
            }
        }
    };

    /**
     * Translates a key into the currently loaded language.
     * Handles nested keys (e.g., "metrics.peakVolume").
     * @param {string} key - The translation key.
     * @param {object} [options] - Optional parameters (e.g., for interpolation). Not implemented here yet.
     * @returns {string} The translated string, or the key itself if not found.
     */
    const t = (key, options = {}) => {
        if (!key) return '';

        // Navigate nested keys
        const keys = key.split('.');
        let result = translations;

        for (const k of keys) {
            if (result && typeof result === 'object' && result.hasOwnProperty(k)) {
                result = result[k];
            } else {
                // Key not found
                console.warn(`Translation key not found: "${key}" for language "${currentLanguage}"`);
                return key; // Return the key itself as fallback
            }
        }

        // Basic interpolation (example: replace {placeholder} )
        if (typeof result === 'string' && options) {
             Object.keys(options).forEach(placeholder => {
                 const regex = new RegExp(`{${placeholder}}`, 'g');
                 result = result.replace(regex, options[placeholder]);
             });
        }


        return typeof result === 'string' ? result : key; // Ensure we return a string
    };

    /**
     * Applies translations to all static elements with data-i18n attributes.
     * Also updates document title and meta description.
     */
    const applyTranslationsToStaticElements = () => {
        console.log("Applying static translations...");
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = t(key);

            // Check for specific attributes to translate (e.g., placeholder, aria-label, title)
            const translateAttribute = element.getAttribute('data-i18n-attr');
            if (translateAttribute) {
                element.setAttribute(translateAttribute, translation);
            } else {
                // Default to textContent
                element.textContent = translation;
            }
        });

        // Update essential SEO tags
        document.title = t('appTitle'); // Assuming 'appTitle' key exists in JSON
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) {
            metaDescription.setAttribute('content', t('metaDescription')); // Assuming 'metaDescription' key exists
        }

        // Update Open Graph tags if needed (more complex if they need dynamic content)
        const ogTitle = document.querySelector('meta[property="og:title"]');
         if (ogTitle) ogTitle.setAttribute('content', t('appTitle')); // Use same title or a specific ogTitle key
         const ogDescription = document.querySelector('meta[property="og:description"]');
         if (ogDescription) ogDescription.setAttribute('content', t('metaDescription')); // Use same desc or specific ogDesc key


        console.log("Static translations applied.");
    };

    /**
     * Updates the language switcher UI element.
     */
    const updateLanguageSwitcher = () => {
        const selectorElement = document.getElementById('language-selector');
        if (!selectorElement) return;

        selectorElement.innerHTML = ''; // Clear existing links

        for (const langCode in supportedLanguages) {
            const link = document.createElement('a');
            // Construct URL based on language code (root for default, /code/ for others)
            // Adjust base path as needed (e.g., '/mic-analyzer/')
            const basePath = '/'; // Change if deployed in a subdirectory like /mic-analyzer/
            link.href = langCode === defaultLanguage ? basePath : `${basePath}${langCode}/`;
            link.textContent = supportedLanguages[langCode]; // Native language name
            link.setAttribute('hreflang', langCode); // Good for SEO/accessibility
            link.dataset.langCode = langCode; // Add data attribute for potential JS interaction

            if (langCode === currentLanguage) {
                link.classList.add('active');
                link.setAttribute('aria-current', 'page'); // Accessibility
            }

            // Add event listener to handle language change via JS (optional, href handles navigation)
            // link.addEventListener('click', (e) => {
            //     e.preventDefault(); // Prevent default navigation if handling purely via JS state
            //     setLanguage(langCode);
            //     // Might need history.pushState here for SPA-like behavior without full page reload
            // });

            selectorElement.appendChild(link);
        }
         console.log("Language switcher updated.");
    };


    /**
     * Sets the application language, loads translations, and updates the UI.
     * @param {string} lang - The language code to set.
     * @returns {Promise<void>}
     */
    const setLanguage = async (lang) => {
        if (!supportedLanguages.hasOwnProperty(lang)) {
            console.warn(`Attempted to set unsupported language: ${lang}. Using ${currentLanguage}.`);
            return;
        }

        console.log(`Setting language to: ${lang}`);
        try {
            await loadTranslations(lang);
            currentLanguage = lang;
            localStorage.setItem(localStorageKey, lang); // Store preference
            document.documentElement.lang = lang; // Update <html lang="...">

            // Apply translations to static elements defined in HTML
            applyTranslationsToStaticElements();

            // Update the language switcher UI
            updateLanguageSwitcher();

            // Notify other modules that language has changed (e.g., using a custom event)
            // This allows dynamic UI elements created by other JS files to update their text.
            window.dispatchEvent(new CustomEvent('languagechange', { detail: { lang: currentLanguage } }));
            console.log(`Language successfully set to ${lang}.`);

        } catch (error) {
            console.error(`Failed to set language "${lang}":`, error);
            // UI might be in an inconsistent state here, consider fallback UI update
        }
    };

    /**
     * Initializes the i18n module.
     */
    const init = () => {
        console.log("i18n module initializing...");
        const initialLang = detectLanguage();
        setLanguage(initialLang); // Load and apply initial language

        // Optional: Listen for popstate events if using History API for navigation
        // window.addEventListener('popstate', () => {
        //     const lang = detectLanguage(); // Re-detect based on new URL
        //     if (lang !== currentLanguage) {
        //         setLanguage(lang);
        //     }
        // });
    };

    // --- Expose Public Methods ---
    window.i18n = {
        init,
        setLanguage,
        t, // Expose the translation function
        getCurrentLanguage: () => currentLanguage,
        supportedLanguages // Expose supported languages if needed externally
    };

})(window);
