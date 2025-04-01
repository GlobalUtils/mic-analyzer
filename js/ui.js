// js/ui.js

(function(window) {
    'use strict';

    // --- DOM Element References ---
    // Cache frequently accessed elements
    const elements = {
        // Buttons
        startButton: document.getElementById('start-test-button'),
        stopButton: document.getElementById('stop-test-button'),
        recordButton: document.getElementById('record-button'),
        playButton: document.getElementById('play-button'),
        // Status & Info
        statusMessage: document.getElementById('status-message'),
        micName: document.getElementById('mic-name'),
        // Visualization
        canvas: document.getElementById('visualizer-canvas'),
        // Metric Cards (using a helper function to get specific card elements)
        metricCards: document.querySelectorAll('.metric-card'),
        // Tips Section
        tipsSection: document.getElementById('tips-section'),
        tipsList: document.getElementById('tips-list'),
        // Playback
        audioPlayback: document.getElementById('audio-playback'),
        // Modal
        modal: document.getElementById('explanation-modal'),
        modalTitle: document.getElementById('explanation-title'),
        modalText: document.getElementById('explanation-text'),
        closeModalButton: document.getElementById('close-modal-button'),
        // Info Buttons
        infoButtons: document.querySelectorAll('.info-button')
    };

    // Canvas context
    const canvasCtx = elements.canvas?.getContext('2d'); // Use optional chaining

    // --- Helper Functions ---

    /**
     * Gets specific elements within a metric card.
     * @param {string} metricKey - The key used in data-metric attribute.
     * @returns {{card: Element|null, valueEl: Element|null, meterEl: Element|null}}
     */
    const getMetricCardElements = (metricKey) => {
        const card = document.querySelector(`.metric-card[data-metric="${metricKey}"]`);
        if (!card) return { card: null, valueEl: null, meterEl: null };
        return {
            card: card,
            valueEl: card.querySelector('.value'),
            meterEl: card.querySelector('meter')
        };
    };

    /**
     * Formats dBFS values for display.
     * @param {number} value - dBFS value.
     * @returns {string} Formatted string (e.g., "-12.3 dBFS" or "--- dBFS").
     */
    const formatDBFS = (value) => {
        if (!isFinite(value) || value <= -100) { // Use -100 as practical minimum display
            return `--- ${i18n.t('units.dbfs') || 'dBFS'}`;
        }
        return `${value.toFixed(1)} ${i18n.t('units.dbfs') || 'dBFS'}`;
    };

    // --- UI Update Functions ---

    /**
     * Updates the main status message area.
     * @param {string} textKey - Translation key for the message.
     * @param {'idle'|'testing'|'recording'|'playing'|'error'|'warning'|'info'} type - Type of message for styling.
     * @param {object} [options] - Interpolation options for i18n.t().
     */
    const updateStatusMessage = (textKey, type = 'info', options = {}) => {
        if (!elements.statusMessage) return;
        const message = i18n.t(textKey, options);
        elements.statusMessage.textContent = message;
        // Apply styling based on type
        elements.statusMessage.className = 'status-message'; // Reset classes
        if (type !== 'info' && type !== 'idle') {
            elements.statusMessage.classList.add(`status-${type}`);
        }
         console.log(`Status Update (${type}): ${message}`);
    };

    /**
     * Updates the displayed microphone name.
     * @param {string} name - The name of the microphone.
     */
    const updateMicName = (name) => {
        if (elements.micName) {
            elements.micName.textContent = name || i18n.t('micNameUnknown') || 'Unknown Microphone';
        }
    };

    /**
     * Sets the enabled/disabled state of control buttons.
     * @param {object} states - Object with button IDs as keys and boolean (true=enabled) as values.
     *                         e.g., { start: false, stop: true, record: true, play: false }
     */
    const setButtonStates = (states) => {
        if (elements.startButton) elements.startButton.disabled = !states.start;
        if (elements.stopButton) elements.stopButton.disabled = !states.stop;
        if (elements.recordButton) elements.recordButton.disabled = !states.record;
        if (elements.playButton) elements.playButton.disabled = !states.play;
    };

    /**
     * Updates a specific metric card's value and meter.
     * @param {string} metricKey - The metric identifier (e.g., 'peakVolume').
     * @param {number|string|boolean} value - The raw metric value.
     */
    const updateMetric = (metricKey, value) => {
        const { valueEl, meterEl } = getMetricCardElements(metricKey);
        if (!valueEl) return; // Exit if card elements not found

        let displayValue = value;
        let meterValue = null;
        let statusClass = ''; // e.g., status-ok, status-warn, status-critical

        // Format specific metrics
        switch (metricKey) {
            case 'peakVolume':
            case 'rmsVolume':
            case 'noiseLevel':
                displayValue = formatDBFS(value);
                meterValue = isFinite(value) ? Math.max(-60, value) : -60; // Clamp meter value
                // Add status classes based on thresholds (example)
                if (meterEl) { // Check if meter exists for this metric
                     if (value > (meterEl.high ?? -3)) statusClass = 'status-critical';
                     else if (value > (meterEl.low ?? -12)) statusClass = 'status-warn';
                     else if (value > -55) statusClass = 'status-ok'; // Only OK if clearly above noise floor
                }
                break;
            case 'clipping':
                displayValue = value ? (i18n.t('status.detected') || 'Detected') : (i18n.t('status.ok') || 'OK');
                statusClass = value ? 'status-critical' : 'status-ok';
                break;
            case 'sampleRate':
                displayValue = value ? `${value} ${i18n.t('units.hz') || 'Hz'}` : '--- Hz';
                statusClass = 'status-info'; // Or apply logic if needed
                break;
            case 'channels':
                displayValue = value ? (value === 1 ? (i18n.t('channels.mono') || 'Mono') : (i18n.t('channels.stereo') || 'Stereo')) : '---';
                statusClass = 'status-info';
                break;
            default:
                // Default handling for other potential metrics
                displayValue = value?.toString() ?? '---';
        }

        valueEl.textContent = displayValue;
        // Remove previous status classes before adding new one
        valueEl.classList.remove('status-ok', 'status-warn', 'status-critical', 'status-info');
        if (statusClass) {
            valueEl.classList.add(statusClass);
        }

        if (meterEl && meterValue !== null) {
            meterEl.value = meterValue;
        }
    };

    /**
     * Resets all metric displays to their default state.
     */
    const resetMetrics = () => {
        elements.metricCards.forEach(card => {
            const key = card.dataset.metric;
            if (key) {
                // Reset based on type (could be more specific)
                 updateMetric(key, null); // Pass null to trigger default display
            }
        });
         if (elements.canvas) {
             clearVisualization(); // Clear the canvas too
         }
    };


    /**
     * Draws the audio visualization (waveform or frequency spectrum) on the canvas.
     * @param {Uint8Array} timeData - Data from analyserNode.getByteTimeDomainData.
     * @param {Uint8Array} freqData - Data from analyserNode.getByteFrequencyData.
     * @param {'waveform'|'frequency'} [type='frequency'] - Type of visualization to draw.
     */
    const drawVisualization = (timeData, freqData, type = 'frequency') => {
        if (!canvasCtx || !elements.canvas) return;

        const width = elements.canvas.width;
        const height = elements.canvas.height;

        canvasCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-light').trim() || '#f8f9fa'; // Use CSS var
        canvasCtx.fillRect(0, 0, width, height);

        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#007bff';

        canvasCtx.beginPath();

        if (type === 'waveform' && timeData) {
            const sliceWidth = width * 1.0 / timeData.length;
            let x = 0;

            for (let i = 0; i < timeData.length; i++) {
                const v = timeData[i] / 128.0; // value between 0 and 2
                const y = v * height / 2;

                if (i === 0) {
                    canvasCtx.moveTo(x, y);
                } else {
                    canvasCtx.lineTo(x, y);
                }
                x += sliceWidth;
            }
        } else if (type === 'frequency' && freqData) {
            const bufferLength = freqData.length;
            const barWidth = (width / bufferLength) * 1.5; // Adjust multiplier for bar width/spacing
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const barHeight = (freqData[i] / 255.0) * height; // Scale height

                // Optional: Use different colors based on amplitude
                // const intensity = freqData[i] / 255;
                // canvasCtx.fillStyle = `rgb(${Math.floor(intensity * 255)}, 50, ${Math.floor((1-intensity)*100)})`;
                canvasCtx.fillStyle = canvasCtx.strokeStyle; // Use stroke color for bars

                canvasCtx.fillRect(x, height - barHeight, barWidth, barHeight);

                x += barWidth + 1; // Add 1 for spacing between bars
            }
            // Note: We are drawing filled rectangles, not using stroke here.
            // If stroke was intended, replace fillRect with strokeRect or use lineTo.
            // Since we used beginPath(), we should call stroke() or fill() if we drew lines.
            // For the bar chart, fillRect is sufficient. No need for stroke() here.
        }

        // If drawing waveform lines:
        if (type === 'waveform') {
             canvasCtx.lineTo(width, height / 2);
             canvasCtx.stroke();
        }
    };

     /** Clears the visualization canvas */
     const clearVisualization = () => {
         if (!canvasCtx || !elements.canvas) return;
         const width = elements.canvas.width;
         const height = elements.canvas.height;
         canvasCtx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-light').trim() || '#f8f9fa';
         canvasCtx.fillRect(0, 0, width, height);
     };


    /**
     * Displays generated tips in the UI.
     * @param {Array<object>} tips - Array of tip objects { icon: string, textKey: string, level: 'info'|'warning'|'danger' }.
     */
    const displayTips = (tips) => {
        if (!elements.tipsSection || !elements.tipsList) return;

        elements.tipsList.innerHTML = ''; // Clear previous tips

        if (tips && tips.length > 0) {
            tips.forEach(tip => {
                const li = document.createElement('li');
                li.classList.add(`tip-${tip.level || 'info'}`); // Add class for styling

                const iconSpan = document.createElement('span');
                iconSpan.classList.add('icon');
                iconSpan.setAttribute('aria-hidden', 'true'); // Decorative icon
                iconSpan.textContent = tip.icon || '💡';

                const textSpan = document.createElement('span');
                textSpan.textContent = i18n.t(tip.textKey); // Translate the tip text key

                li.appendChild(iconSpan);
                li.appendChild(textSpan);
                elements.tipsList.appendChild(li);
            });
            elements.tipsSection.style.display = 'block'; // Show the section
        } else {
            elements.tipsSection.style.display = 'none'; // Hide if no tips
        }
    };

    /**
     * Sets the source for the audio playback element.
     * @param {string|null} url - The Blob URL of the recording, or null to clear.
     */
    const setPlaybackSource = (url) => {
        if (elements.audioPlayback) {
            if (url) {
                elements.audioPlayback.src = url;
                 // Optional: Revoke previous object URL to free memory
                 // This needs careful handling if playback is ongoing
                 // const oldUrl = elements.audioPlayback.dataset.currentUrl;
                 // if (oldUrl && oldUrl !== url) {
                 //     URL.revokeObjectURL(oldUrl);
                 // }
                 // elements.audioPlayback.dataset.currentUrl = url;
            } else {
                elements.audioPlayback.removeAttribute('src');
                 // const oldUrl = elements.audioPlayback.dataset.currentUrl;
                 // if (oldUrl) {
                 //     URL.revokeObjectURL(oldUrl);
                 //     elements.audioPlayback.dataset.currentUrl = '';
                 // }
            }
        }
    };

    /** Plays the audio loaded in the playback element */
    const playAudio = () => {
        if (elements.audioPlayback && elements.audioPlayback.src) {
            elements.audioPlayback.play().catch(err => {
                console.error("Playback error:", err);
                updateStatusMessage('errorPlayback', 'error');
            });
        } else {
            console.warn("No audio source to play.");
        }
    };

    /** Shows the explanation modal with content for the given metric key */
    const showExplanationModal = (metricKey) => {
        if (!elements.modal || !elements.modalTitle || !elements.modalText) return;

        const titleKey = `metrics.${metricKey}`;
        const explanationKey = `explanations.${metricKey}`; // Assuming explanations are stored in locale files

        elements.modalTitle.textContent = i18n.t(titleKey);
        elements.modalText.textContent = i18n.t(explanationKey, { defaultValue: i18n.t('explanationNotFound') }); // Provide fallback

        elements.modal.style.display = 'block';
        elements.closeModalButton?.focus(); // Focus close button for accessibility
    };

    /** Hides the explanation modal */
    const hideExplanationModal = () => {
        if (elements.modal) {
            elements.modal.style.display = 'none';
        }
    };


    // --- Event Listener Setup --- (Moved to app.js for better separation)
    // We only define the functions here. app.js will attach them to events.

    // --- Language Change Listener ---
    /** Handles language changes to update dynamic UI text */
    const handleLanguageChange = () => {
        console.log("UI: Language change detected, updating relevant text...");
        // Re-translate any text that might have been set dynamically and needs updating
        // Example: Resetting metrics might re-display default text like "--- dBFS"
        // If the unit name ("dBFS") is translated, it needs updating.
        resetMetrics(); // Easiest way to re-apply formatting with new units

        // Re-translate status message if it's currently displayed
        // This requires app.js to store the last status key/type and call updateStatusMessage again
        // Or, add data-i18n-key and data-i18n-type attributes to the status message element
        // and re-translate here. Let's assume app.js handles re-triggering status updates.

        // Re-translate tips if they are currently displayed
        // Requires app.js to store the last set of tips and call displayTips again.

        // Re-translate modal title/text if it's open
        if (elements.modal && elements.modal.style.display === 'block') {
            const currentMetricKey = elements.modal.dataset.metricKey; // Need to store this when opening
            if (currentMetricKey) {
                showExplanationModal(currentMetricKey); // Re-show to re-translate
            }
        }
    };

    window.addEventListener('languagechange', handleLanguageChange);


    // --- Expose Public Methods ---
    window.UI = {
        updateStatusMessage,
        updateMicName,
        setButtonStates,
        updateMetric,
        resetMetrics,
        drawVisualization,
        clearVisualization,
        displayTips,
        setPlaybackSource,
        playAudio,
        showExplanationModal,
        hideExplanationModal,
        // Expose elements if needed by app.js, though passing data is cleaner
        elements
    };

})(window);
