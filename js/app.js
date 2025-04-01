// js/app.js

(function(window, MicAnalyzer, UI, i18n) {
    'use strict';

    // --- Application State ---
    let appState = 'idle'; // Possible states: idle, initializing, testing, recording, playing, stopped, error
    let currentBlobUrl = null; // Store the URL of the last recording
    let lastMetrics = null; // Store the last received metrics object
    let lastStatus = { key: 'statusIdle', type: 'idle' }; // Store last status message info

    // --- Initialization ---

    /**
     * Initializes the application, sets up event listeners.
     */
    const init = () => {
        console.log("App initializing...");

        // 1. Initialize i18n first (as UI elements might need translation on load)
        // i18n.init(); // Assuming i18n.js runs its init automatically via IIFE execution

        // 2. Set initial UI state
        UI.setButtonStates({ start: true, stop: false, record: false, play: false });
        UI.resetMetrics();
        UI.clearVisualization();
        UI.updateStatusMessage(lastStatus.key, lastStatus.type); // Show initial idle message

        // 3. Add Event Listeners
        setupEventListeners();

        // 4. Handle page unload for cleanup
        window.addEventListener('beforeunload', handlePageUnload);

        // 5. Listen for language changes to potentially update dynamic text
        window.addEventListener('languagechange', handleAppLanguageChange);


        console.log("App initialized and ready.");
    };

    // --- Event Listener Setup ---

    const setupEventListeners = () => {
        console.log("Setting up event listeners...");

        // --- Control Buttons ---
        UI.elements.startButton?.addEventListener('click', handleStartClick);
        UI.elements.stopButton?.addEventListener('click', handleStopClick);
        UI.elements.recordButton?.addEventListener('click', handleRecordClick);
        UI.elements.playButton?.addEventListener('click', handlePlayClick);

        // --- Modal ---
        UI.elements.closeModalButton?.addEventListener('click', UI.hideExplanationModal);
        // Close modal if clicking outside the content area
        UI.elements.modal?.addEventListener('click', (event) => {
            if (event.target === UI.elements.modal) {
                UI.hideExplanationModal();
            }
        });

        // --- Info Buttons ---
        UI.elements.infoButtons?.forEach(button => {
            button.addEventListener('click', () => {
                const metricKey = button.dataset.metricInfo;
                if (metricKey) {
                    // Store the key on the modal element itself for potential re-translation
                    UI.elements.modal.dataset.metricKey = metricKey;
                    UI.showExplanationModal(metricKey);
                }
            });
        });

        // --- Playback Events ---
        UI.elements.audioPlayback?.addEventListener('play', () => {
            setAppState('playing');
            updateStatusMessage('statusPlaying', 'info');
            // Disable play button while playing? Maybe allow pausing? For simplicity, keep enabled.
        });
        UI.elements.audioPlayback?.addEventListener('ended', () => {
            // Return to previous relevant state (likely 'stopped' or 'idle' if stopped before play)
            setAppState(MicAnalyzer.analyserNode ? 'testing' : 'stopped'); // Go back to testing if analysis is running
            updateStatusMessage(lastStatus.key, lastStatus.type); // Restore previous status
        });
        UI.elements.audioPlayback?.addEventListener('error', (e) => {
            console.error("Audio playback error:", e);
            updateStatusMessage('errorPlayback', 'error');
            setAppState('error');
        });

         console.log("Event listeners attached.");
    };

    // --- Event Handlers ---

    const handleStartClick = async () => {
        if (appState !== 'idle' && appState !== 'stopped' && appState !== 'error') return;

        console.log("Start button clicked.");
        setAppState('initializing');
        updateStatusMessage('statusInitializing', 'info');
        UI.setButtonStates({ start: false, stop: false, record: false, play: false });
        UI.resetMetrics(); // Clear previous metrics
        UI.displayTips([]); // Clear previous tips

        try {
            // Initialize microphone and audio analysis components
            const { streamInfo } = await MicAnalyzer.initMic();

            // Update UI with static info now available
            UI.updateMetric('sampleRate', streamInfo.sampleRate);
            UI.updateMetric('channels', streamInfo.channelCount);
            // Attempt to get microphone label (might require a brief delay after permission)
            setTimeout(updateMicLabel, 100); // Small delay often helps

            // Start the analysis loop, providing callbacks for UI updates
            MicAnalyzer.startAnalysis(handleMetricsUpdate, UI.drawVisualization);

            setAppState('testing');
            updateStatusMessage('statusTesting', 'info');
            // Enable Stop and Record (if supported)
            UI.setButtonStates({
                start: false,
                stop: true,
                record: !!MicAnalyzer.mediaRecorder, // Only enable if recorder is ready
                play: !!currentBlobUrl // Enable play if there's a previous recording
            });

        } catch (error) {
            console.error("Initialization failed:", error);
            let errorKey = 'errorInitGeneric';
            if (error.message === 'PermissionDenied') errorKey = 'errorPermissionDenied';
            else if (error.message === 'NotFound') errorKey = 'errorMicNotFound';

            updateStatusMessage(errorKey, 'error');
            setAppState('error');
            UI.setButtonStates({ start: true, stop: false, record: false, play: false }); // Allow retry
        }
    };

    const handleStopClick = () => {
        if (appState !== 'testing' && appState !== 'recording') return; // Can stop while testing or recording

        console.log("Stop button clicked.");
        MicAnalyzer.stopAnalysis(); // Stop processing audio data
        // Note: We don't call cleanup() here, just stop analysis. Cleanup is for unload/re-init.
        // If recording, stop that too (though usually stopAnalysis implies no more data for recorder)
        if (appState === 'recording') {
             MicAnalyzer.stopRecording(handleRecordingStop, handleRecordingError); // Ensure recording stops cleanly
        }

        setAppState('stopped');
        updateStatusMessage('statusStopped', 'info');
        UI.setButtonStates({
            start: true, // Allow restarting
            stop: false,
            record: false, // Can't record when stopped
            play: !!currentBlobUrl // Keep play enabled if recording exists
        });
        // Optional: Clear visualization when stopped? Or leave the last frame?
        // UI.clearVisualization();
    };

    const handleRecordClick = () => {
        if (appState !== 'testing') return; // Can only record while testing

        console.log("Record button clicked.");
        setAppState('recording');
        updateStatusMessage('statusRecording', 'recording'); // Use specific style
        UI.setButtonStates({ start: false, stop: true, record: false, play: false }); // Disable record/play during recording
        UI.setPlaybackSource(null); // Clear previous recording URL visually
        // Revoke previous URL if desired (handle carefully)
        if (currentBlobUrl) {
             URL.revokeObjectURL(currentBlobUrl);
             currentBlobUrl = null;
        }


        MicAnalyzer.startRecording(
            () => { console.log("App: Recording started callback received."); /* Optional UI feedback */ },
            handleRecordingStop,
            handleRecordingError
        );
    };

    const handlePlayClick = () => {
        if (!currentBlobUrl || appState === 'recording' || appState === 'playing') return;

        console.log("Play button clicked.");
        UI.playAudio();
        // State/status updated via playback event listeners
    };

    const handlePageUnload = (event) => {
        console.log("Page unloading, cleaning up resources...");
        MicAnalyzer.cleanup();
        // Revoke blob URL on unload
        if (currentBlobUrl) {
            URL.revokeObjectURL(currentBlobUrl);
        }
    };

    // --- Callbacks from MicAnalyzer ---

    /**
     * Handles metric updates from the analyzer.
     * @param {object} metrics - The calculated metrics object.
     */
    const handleMetricsUpdate = (metrics) => {
        lastMetrics = metrics; // Store for potential use (e.g., generating tips)

        // Update individual metric displays
        UI.updateMetric('peakVolume', metrics.peakVolume);
        UI.updateMetric('rmsVolume', metrics.rmsVolume);
        UI.updateMetric('clipping', metrics.clipping);
        UI.updateMetric('noiseLevel', metrics.noiseLevel);
        // DC Offset, etc., if implemented

        // Generate and display tips based on current metrics (example)
        const tips = generateActionableTips(metrics);
        UI.displayTips(tips);
    };

    /**
     * Handles the completion of a recording.
     * @param {string} blobUrl - The Object URL for the recorded audio blob.
     */
    const handleRecordingStop = (blobUrl) => {
        console.log("App: Recording stopped callback received. URL:", blobUrl);
        currentBlobUrl = blobUrl; // Store the URL
        UI.setPlaybackSource(blobUrl);

        // Revert state (usually back to 'testing' if analysis is still running)
        if (MicAnalyzer.analyserNode) { // Check if analysis was stopped in the meantime
             setAppState('testing');
             updateStatusMessage('statusTesting', 'info'); // Or a "Recording finished" message?
             UI.setButtonStates({ start: false, stop: true, record: true, play: true });
        } else {
            // If analysis was stopped while recording finished
            setAppState('stopped');
            updateStatusMessage('statusStopped', 'info');
             UI.setButtonStates({ start: true, stop: false, record: false, play: true });
        }
    };

    /**
     * Handles errors during recording.
     * @param {string} errorMsg - Error identifier or message.
     */
    const handleRecordingError = (errorMsg) => {
        console.error("App: Recording error callback received:", errorMsg);
        let errorKey = 'errorRecordingGeneric';
        if (errorMsg === 'NoDataRecorded') errorKey = 'errorRecordingNoData';
        // Add more specific keys if needed

        updateStatusMessage(errorKey, 'error');
        // Revert state (usually back to 'testing' if analysis is still running)
         if (MicAnalyzer.analyserNode) {
             setAppState('testing');
             UI.setButtonStates({ start: false, stop: true, record: true, play: !!currentBlobUrl }); // Re-enable record
         } else {
             setAppState('stopped');
              UI.setButtonStates({ start: true, stop: false, record: false, play: !!currentBlobUrl });
         }
    };

    // --- Language Change Handling ---
    const handleAppLanguageChange = () => {
         console.log("App: Handling language change...");
         // Re-apply the last status message with the new language
         updateStatusMessage(lastStatus.key, lastStatus.type, lastStatus.options);

         // Re-generate and display tips if they were shown
         if (lastMetrics && UI.elements.tipsSection?.style.display === 'block') {
             const tips = generateActionableTips(lastMetrics);
             UI.displayTips(tips);
         }
         // Note: Static text (buttons, titles) is handled by i18n.js and ui.js listener
    };


    // --- Utility Functions ---

    /**
     * Sets the application state and logs it.
     * @param {string} newState
     */
    const setAppState = (newState) => {
        console.log(`App State Change: ${appState} -> ${newState}`);
        appState = newState;
        // Optional: Add class to body for global state styling?
        // document.body.className = `state-${newState}`;
    };

    /** Wrapper for UI.updateStatusMessage that also stores the last status */
    const updateStatusMessage = (key, type, options = {}) => {
        lastStatus = { key, type, options };
        UI.updateStatusMessage(key, type, options);
    };


    /** Attempts to get and display the microphone label */
    const updateMicLabel = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const audioInput = devices.find(device => device.kind === 'audioinput');
            // Note: Label might be empty if permission wasn't granted persistently or due to browser privacy.
            if (audioInput && audioInput.label) {
                UI.updateMicName(audioInput.label);
            } else {
                 UI.updateMicName(i18n.t('micNameDefault') || 'Default Microphone'); // Fallback name
            }
        } catch (err) {
            console.error("Error enumerating devices:", err);
             UI.updateMicName(i18n.t('micNameError') || 'Error getting name');
        }
    };

    /**
     * Generates actionable tips based on metrics. (Example Implementation)
     * @param {object} metrics
     * @returns {Array<object>} Array of tip objects { icon: string, textKey: string, level: 'info'|'warning'|'danger' }
     */
    const generateActionableTips = (metrics) => {
        const tips = [];
        const lowVolumeThreshold = -25; // dBFS (RMS)
        const highVolumeThreshold = -6; // dBFS (RMS) - getting close to clipping
        const noiseThreshold = -45; // dBFS

        if (metrics.clipping) {
            tips.push({ icon: '⚠️', textKey: 'tips.clippingDetected', level: 'danger' });
        } else if (metrics.rmsVolume > highVolumeThreshold && metrics.rmsVolume < -1) {
             tips.push({ icon: '🟡', textKey: 'tips.volumeHigh', level: 'warning' });
        }

        if (metrics.rmsVolume < lowVolumeThreshold && metrics.rmsVolume > -55) { // Avoid triggering on pure silence
            tips.push({ icon: '💡', textKey: 'tips.volumeLow', level: 'info' });
        }

        if (metrics.noiseLevel > noiseThreshold) {
            tips.push({ icon: '🔊', textKey: 'tips.noiseHigh', level: 'warning' });
        }

        // Add more tips based on DC offset, silence, etc.

        return tips;
    };


    // --- Start the application ---
    // Ensure DOM is ready before initializing
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init(); // DOMContentLoaded has already fired
    }

})(window, window.MicAnalyzer, window.UI, window.i18n);
