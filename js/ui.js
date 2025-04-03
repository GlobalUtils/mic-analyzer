// js/ui.js
import { SUPPORTED_LANGUAGES } from './config.js';

// --- DOM Element References ---
// Using a getter function avoids issues with script loading order if elements aren't ready immediately,
// though with `defer` and `DOMContentLoaded` it's less critical.
export const getElement = (id) => document.getElementById(id);

export const uiElements = {
    micSelect: () => getElement('micSelect'),
    startStopButton: () => getElement('startStopButton'),
    recordButton: () => getElement('recordButton'),
    statusP: () => getElement('status'),
    volumeMeter: () => getElement('volumeMeter'),
    waveformCanvas: () => getElement('waveformCanvas'),
    frequencyCanvas: () => getElement('frequencyCanvas'),
    audioPlayback: () => getElement('audioPlayback'),
    recordingStatusP: () => getElement('recordingStatus'),
    analysisSection: () => getElement('analysisSection'),
    recordingSection: () => getElement('recordingSection'),
    themeToggleButton: () => getElement('themeToggleButton'),
    resultsBar: () => getElement('resultsBar'),
    resultsVolume: () => getElement('resultsVolume'),
    resultsSampleRate: () => getElement('resultsSampleRate'),
    langSelect: () => getElement('langSelect'),
    // Add other elements as needed
};

// --- Status Updates ---
/**
 * Updates the main status message area.
 * @param {string} messageKey - The i18n key for the message.
 * @param {string} type - 'info', 'success', 'warning', 'error'.
 * @param {object} [replacements] - Optional key-value pairs for placeholder replacement in the message.
 * @param {function} i18n_t - The translation function.
 */
export function setStatus(messageKey, type = 'info', replacements = {}, i18n_t) {
    const statusP = uiElements.statusP();
    if (!statusP) return;
    const message = i18n_t(messageKey, replacements); // Translate the message
    statusP.textContent = message;
    statusP.className = `status-${type}`; // Apply class based on type
    console.log(`Status (${type}): ${message}`);
}

/**
 * Updates the recording status message area.
 * @param {string} messageKey - The i18n key for the message.
 * @param {string} type - 'info', 'success', 'warning', 'error'.
 * @param {object} [replacements] - Optional key-value pairs for placeholder replacement.
 * @param {function} i18n_t - The translation function.
 */
export function setRecordingStatus(messageKey, type = 'info', replacements = {}, i18n_t) {
    const recordingStatusP = uiElements.recordingStatusP();
    if (!recordingStatusP) return;
    const message = i18n_t(messageKey, replacements); // Translate
    recordingStatusP.textContent = message;
    recordingStatusP.className = `status-${type}`;
    console.log(`Recording Status (${type}): ${message}`);
}

// --- Control States ---
export function disableAllControls() {
    uiElements.micSelect().disabled = true;
    uiElements.startStopButton().disabled = true;
    uiElements.recordButton().disabled = true;
}

export function enableSetupControls() {
    uiElements.micSelect().disabled = false;
    uiElements.startStopButton().disabled = false;
    // Record button enabled separately when monitoring starts
}

/**
 * Updates button states and text based on monitoring/recording status.
 * @param {boolean} isMonitoring
 * @param {boolean} isRecording
 * @param {boolean} mediaRecorderSupported
 * @param {function} i18n_t - The translation function.
 */
export function updateButtonStates(isMonitoring, isRecording, mediaRecorderSupported, i18n_t) {
    const startStopBtn = uiElements.startStopButton();
    const recordBtn = uiElements.recordButton();
    const micSelect = uiElements.micSelect();

    // Start/Stop Button
    startStopBtn.textContent = i18n_t(isMonitoring ? 'stopTestingBtn' : 'startTestingBtn');
    startStopBtn.disabled = isRecording; // Disable if recording

    // Record Button
    recordBtn.disabled = !isMonitoring || isRecording || !mediaRecorderSupported;
    recordBtn.textContent = i18n_t(isRecording ? 'stopRecordingBtn' : 'recordSampleBtn');
    if (isRecording) {
        recordBtn.classList.add('recording');
    } else {
        recordBtn.classList.remove('recording');
    }
    if (!mediaRecorderSupported) {
         recordBtn.title = i18n_t('recordNotSupportedTitle');
    } else if (!isMonitoring) {
         recordBtn.title = i18n_t('recordStartMonitoringTitle');
    } else {
         recordBtn.title = i18n_t(isRecording ? 'stopRecordingTitle' : 'recordSampleTitle');
    }


    // Mic Select
    micSelect.disabled = isMonitoring; // Disable while monitoring/recording
}


// --- UI Sections Visibility ---
export function showAnalysisSection(show = true) {
    uiElements.analysisSection().style.display = show ? 'block' : 'none';
    uiElements.resultsBar().style.display = show ? 'flex' : 'none';
}

export function showRecordingSection(show = true) {
    uiElements.recordingSection().style.display = show ? 'block' : 'none';
}

// --- Microphone List ---
/**
 * Populates the microphone selection dropdown.
 * @param {MediaDeviceInfo[]} devices - Array of audio input devices.
 * @param {function} i18n_t - The translation function.
 */
export function populateMicListOptions(devices, i18n_t) {
    const select = uiElements.micSelect();
    select.innerHTML = ''; // Clear existing options

    if (devices.length === 0) {
        const option = document.createElement('option');
        option.value = "";
        option.textContent = i18n_t('noMicOption');
        option.disabled = true;
        select.appendChild(option);
        select.disabled = true; // Keep disabled if no mics
        return;
    }

    devices.forEach((device, index) => {
        const option = document.createElement('option');
        option.value = device.deviceId;
        const label = device.label || i18n_t('defaultMicLabel', { index: index + 1 });
        option.text = label;
        option.title = `${label} (ID: ${device.deviceId.substring(0, 8)}...)`;
        select.appendChild(option);
    });
    select.disabled = false; // Enable selection
}

// --- Volume Meter & Results Bar ---
export function updateVolumeMeter(level) {
    const percentage = Math.min(100, Math.max(0, level * 100));
    uiElements.volumeMeter().style.width = percentage + '%';
}

export function updateResultsBar(volumePercent, sampleRate) {
    uiElements.resultsVolume().textContent = `${volumePercent}%`;
    if (sampleRate !== null) { // Only update sample rate if provided
        uiElements.resultsSampleRate().textContent = `${sampleRate} Hz`;
    }
}

// --- Playback ---
export function displayPlayback(audioUrl, blob) {
    const player = uiElements.audioPlayback();
    player.src = audioUrl;
    player.style.display = 'block';
    // Optionally display blob info (size, type) in recording status
}

export function hidePlayback() {
     const player = uiElements.audioPlayback();
    player.style.display = 'none';
    player.src = ''; // Clear source
}

// --- Theme Button ---
export function updateThemeButtonText(currentTheme, i18n_t) {
    const button = uiElements.themeToggleButton();
    if (button && i18n_t) { // Check if button and translation function exist
        button.textContent = i18n_t(currentTheme === 'light' ? 'switchToDarkModeBtn' : 'switchToLightModeBtn');
        button.title = i18n_t('toggleThemeBtnTitle');
    }
}

// --- Language Selector ---
export function populateLangSelector(currentLang, i18n_t) {
    const select = uiElements.langSelect();
    select.innerHTML = ''; // Clear existing
    for (const [code, name] of Object.entries(SUPPORTED_LANGUAGES)) {
        const option = document.createElement('option');
        option.value = code;
        option.textContent = name; // Display native language name
        option.selected = code === currentLang;
        select.appendChild(option);
    }
     select.title = i18n_t('selectLangTitle');
}
