// js/main.js
import * as ui from './ui.js';
import * as audio from './audio.js';
import * as visualizer from './visualizer.js';
import * as theme from './theme.js';
import * as i18n from './i18n.js'; // Import translation functions

let animationFrameId = null;

// --- Main Application Logic ---

/**
 * The main animation loop for visualization.
 */
function visualizationLoop() {
    if (!audio.getIsMonitoring()) {
        animationFrameId = null; // Ensure loop stops if monitoring stops unexpectedly
        return;
    }

    const analyserNode = audio.getAnalyserNode();
    const timeData = audio.getTimeDomainData();
    const freqData = audio.getFrequencyData();

    if (analyserNode && timeData && freqData) {
        // Draw visualizations and get volume level
        const volumeLevel = visualizer.draw(analyserNode, timeData, freqData);

        // Update UI elements
        ui.updateVolumeMeter(volumeLevel);
        const volumePercent = Math.round(volumeLevel * 100);
        ui.updateResultsBar(volumePercent, null); // Only update volume here, sample rate is static
    }

    // Continue the loop
    animationFrameId = requestAnimationFrame(visualizationLoop);
}


/**
 * Handles the Start/Stop button click.
 */
async function handleStartStopClick() {
    if (audio.getIsMonitoring()) {
        await audio.stopMonitoring(i18n.t); // Pass translation function
    } else {
        const selectedDeviceId = ui.uiElements.micSelect().value;
        if (!selectedDeviceId && ui.uiElements.micSelect().options.length > 0 && ui.uiElements.micSelect().options[0].value !== "") {
             // If there are mics but none selected (shouldn't happen often with default selection)
             ui.setStatus('statusSelectMic', 'warning', {}, i18n.t);
             return;
        }
         if (!selectedDeviceId && ui.uiElements.micSelect().options.length === 0) {
             ui.setStatus('statusNoMicFound', 'warning', {}, i18n.t);
             return;
         }

        const success = await audio.startMonitoring(selectedDeviceId, i18n.t);
        if (success && !animationFrameId) {
            // Start visualization loop only if monitoring started successfully and loop isn't running
            audio.setVisualizationLoopCallback(visualizationLoop); // Ensure audio module knows the loop function
            animationFrameId = requestAnimationFrame(visualizationLoop);
        }
    }
}

/**
 * Handles the Record/Stop Recording button click.
 */
function handleRecordClick() {
    if (audio.getIsRecording()) {
        audio.stopRecording(i18n.t);
    } else {
        audio.startRecording(i18n.t);
    }
}

/**
 * Handles microphone selection change.
 */
async function handleMicChange() {
    if (audio.getIsMonitoring()) {
        // If monitoring, stop, then restart with the new mic
        ui.setStatus('statusChangingMic', 'info', {}, i18n.t);
        await audio.stopMonitoring(i18n.t);
        // Short delay might help ensure resources are released before restarting
        setTimeout(() => handleStartStopClick(), 100);
    } else {
         // If not monitoring, just update status to reflect selection
         const selectedMicText = ui.uiElements.micSelect().options[ui.uiElements.micSelect().selectedIndex]?.text || 'N/A';
         ui.setStatus('statusMicSelected', 'info', { micName: selectedMicText }, i18n.t);
    }
}

/**
 * Sets up all event listeners for UI controls.
 */
function setupEventListeners() {
    ui.uiElements.startStopButton()?.addEventListener('click', handleStartStopClick);
    ui.uiElements.recordButton()?.addEventListener('click', handleRecordClick);
    ui.uiElements.micSelect()?.addEventListener('change', handleMicChange);
    ui.uiElements.themeToggleButton()?.addEventListener('click', theme.toggleTheme);
    // Language switcher listener is set up within i18n.initI18n
}

/**
 * Initializes the entire application.
 */
async function init() {
    console.log("Mic Analyzer Initializing...");
    theme.initTheme(); // Initialize theme first
    visualizer.initVisualizer(); // Initialize canvas contexts
    visualizer.clearVisualizations(); // Clear initially

    // Initialize i18n - this loads translations and sets up the language switcher
    await i18n.initI18n();

    // Now that translations are loaded, populate device list
    await audio.enumerateDevices(i18n.t); // Pass translation function

    setupEventListeners(); // Setup listeners after elements are potentially translated

    // Update initial button states based on default (not monitoring, not recording)
    ui.updateButtonStates(false, false, ('MediaRecorder' in window), i18n.t);

    console.log("Mic Analyzer Initialized.");
}

// --- Start Application ---
// Wait for the DOM to be fully loaded before initializing
document.addEventListener('DOMContentLoaded', init);
