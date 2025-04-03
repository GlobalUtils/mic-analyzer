// js/audio.js
import { FFT_SIZE } from './config.js';
import * as ui from './ui.js'; // Import all ui functions

// --- State Variables ---
let audioContext = null;
let analyserNode = null;
let sourceNode = null;
let mediaStream = null;
let mediaRecorder = null;
let audioChunks = [];
let isMonitoring = false;
let isRecording = false;
let currentDeviceId = null;
let timeDomainData = null;
let frequencyData = null;
let mediaRecorderSupported = ('MediaRecorder' in window);
let animationFrameId = null; // Store animation frame ID

// --- Callback for visualization loop ---
let visualizationLoopCallback = null;

/**
 * Sets the callback function to be executed in the animation loop.
 * @param {function} callback
 */
export function setVisualizationLoopCallback(callback) {
    visualizationLoopCallback = callback;
}

// --- Getters ---
export const getIsMonitoring = () => isMonitoring;
export const getIsRecording = () => isRecording;
export const getSampleRate = () => audioContext ? audioContext.sampleRate : null;
export const getAnalyserNode = () => analyserNode;
export const getTimeDomainData = () => timeDomainData;
export const getFrequencyData = () => frequencyData;

// --- Core Logic ---

/**
 * Requests microphone permission (implicitly called by getUserMedia).
 * @returns {Promise<boolean>} True if permission granted, false otherwise.
 */
async function requestMicrophonePermission() {
    try {
        // Requesting stream just to trigger permission prompt if needed
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        // Immediately stop the tracks if we only wanted the permission
        stream.getTracks().forEach(track => track.stop());
        return true;
    } catch (err) {
        console.error('Microphone permission error:', err);
        return false;
    }
}

/**
 * Enumerates audio input devices and populates the UI list.
 * @param {function} i18n_t - Translation function.
 */
export async function enumerateDevices(i18n_t) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        ui.setStatus('statusErrorNoDeviceEnum', 'error', {}, i18n_t);
        ui.disableAllControls();
        return;
    }

    ui.setStatus('statusRequestingMicList', 'info', {}, i18n_t);

    try {
        // Ensure permission is granted before enumerating devices fully
        const permissionGranted = await requestMicrophonePermission();
        if (!permissionGranted) {
             // Try enumerating anyway, might show default devices without labels
             const devices = await navigator.mediaDevices.enumerateDevices();
             const audioInputDevices = devices.filter(device => device.kind === 'audioinput');
             if (audioInputDevices.length > 0) {
                 ui.populateMicListOptions(audioInputDevices, i18n_t);
                 ui.setStatus('statusPermissionDeniedLimited', 'warning', {}, i18n_t);
                 ui.enableSetupControls(); // Allow selection, but warn
             } else {
                 ui.setStatus('statusPermissionDenied', 'error', {}, i18n_t);
                 ui.disableAllControls();
             }
            return;
        }

        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputDevices = devices.filter(device => device.kind === 'audioinput');

        if (audioInputDevices.length === 0) {
            ui.setStatus('statusNoMicFound', 'warning', {}, i18n_t);
            ui.disableAllControls();
            return;
        }

        ui.populateMicListOptions(audioInputDevices, i18n_t);
        ui.enableSetupControls();
        ui.setStatus('statusReady', 'success', {}, i18n_t);

    } catch (err) {
        console.error('Error enumerating devices:', err);
        let errorKey = 'statusErrorListingMics';
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            errorKey = 'statusPermissionDenied';
        } else if (err.name === 'NotFoundError') {
             errorKey = 'statusNoMicFound'; // Or a more specific error
        }
        ui.setStatus(errorKey, 'error', { errorName: err.name }, i18n_t);
        ui.disableAllControls();
    }
}

/**
 * Starts audio monitoring and visualization.
 * @param {string} deviceId - The ID of the microphone device to use.
 * @param {function} i18n_t - Translation function.
 * @returns {Promise<boolean>} True if successful, false otherwise.
 */
export async function startMonitoring(deviceId, i18n_t) {
    if (isMonitoring) return true; // Already monitoring

    ui.setStatus('statusStarting', 'info', {}, i18n_t);
    currentDeviceId = deviceId;

    try {
        const constraints = {
            audio: {
                deviceId: deviceId ? { exact: deviceId } : undefined,
                // Optional: Add constraints like echoCancellation, noiseSuppression
                // echoCancellation: true, noiseSuppression: true, autoGainControl: false
            },
            video: false
        };

        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = FFT_SIZE;
        analyserNode.smoothingTimeConstant = 0.8; // Adjust for smoother visuals

        sourceNode = audioContext.createMediaStreamSource(mediaStream);
        sourceNode.connect(analyserNode);
        // DO NOT connect analyserNode to audioContext.destination for monitoring

        // Allocate data arrays
        timeDomainData = new Uint8Array(analyserNode.frequencyBinCount);
        frequencyData = new Uint8Array(analyserNode.frequencyBinCount);

        isMonitoring = true;
        ui.showAnalysisSection(true);
        ui.updateButtonStates(isMonitoring, isRecording, mediaRecorderSupported, i18n_t);
        ui.updateResultsBar(0, getSampleRate()); // Update sample rate display
        ui.setStatus('statusMonitoring', 'success', {}, i18n_t);

        // Start the visualization loop
        if (visualizationLoopCallback) {
            animationFrameId = requestAnimationFrame(visualizationLoopCallback);
        }

        return true;

    } catch (err) {
        console.error('Error starting monitoring:', err);
        let errorKey = 'statusErrorStartingMic';
         if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
             errorKey = 'statusPermissionDenied';
         } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
             errorKey = 'statusMicNotFoundOnStart';
         } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
             errorKey = 'statusMicInUse';
         } else if (err.name === 'OverconstrainedError') {
             errorKey = 'statusMicConstraint';
         }
        ui.setStatus(errorKey, 'error', { errorName: err.name }, i18n_t);
        await stopMonitoring(i18n_t); // Clean up any partial setup
        return false;
    }
}

/**
 * Stops audio monitoring and cleans up resources.
 * @param {function} i18n_t - Translation function.
 */
export async function stopMonitoring(i18n_t) {
    if (!isMonitoring && !mediaStream) return; // Already stopped

    console.log("Stopping monitoring...");
    if (isRecording) {
        await stopRecording(i18n_t); // Ensure recording stops first
    }

    // Stop the visualization loop
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    if (mediaStream) {
        mediaStream.getTracks().forEach(track => track.stop());
        mediaStream = null;
    }
    if (sourceNode) {
        sourceNode.disconnect();
        sourceNode = null;
    }
    analyserNode = null; // No need to disconnect analyser if source is gone

    if (audioContext && audioContext.state !== 'closed') {
        try {
            await audioContext.close();
            console.log("AudioContext closed.");
        } catch (e) {
            console.warn("Error closing AudioContext:", e);
        }
        audioContext = null;
    }

    isMonitoring = false;
    timeDomainData = null;
    frequencyData = null;

    // Update UI
    ui.showAnalysisSection(false);
    ui.showRecordingSection(false); // Hide recording section too
    ui.hidePlayback();
    ui.updateButtonStates(isMonitoring, isRecording, mediaRecorderSupported, i18n_t);
    ui.updateVolumeMeter(0); // Reset volume meter visually
    ui.updateResultsBar(0, null); // Reset results bar volume, keep sample rate empty
    ui.clearVisualizations(); // Clear canvases
    ui.setStatus('statusStopped', 'info', {}, i18n_t);
}


// --- Recording Logic ---

/**
 * Starts recording audio from the current media stream.
 * @param {function} i18n_t - Translation function.
 */
export function startRecording(i18n_t) {
    if (!isMonitoring || !mediaStream || !mediaRecorderSupported) {
        ui.setRecordingStatus('recStatusCannotStart', 'warning', {}, i18n_t);
        return;
    }
    if (isRecording) return;

    audioChunks = []; // Reset chunks
    try {
        // Determine supported MIME type (prefer Opus in WebM)
        let options = { mimeType: 'audio/webm;codecs=opus' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            console.warn(`${options.mimeType} not supported, trying audio/ogg;codecs=opus`);
            options = { mimeType: 'audio/ogg;codecs=opus' };
            if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                console.warn(`${options.mimeType} not supported, trying audio/webm (default)`);
                options = { mimeType: 'audio/webm' }; // Common fallback
                 if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                     console.warn(`${options.mimeType} not supported, trying browser default`);
                     options = {}; // Let the browser choose
                 }
            }
        }
        console.log("Using MediaRecorder options:", options);

        mediaRecorder = new MediaRecorder(mediaStream, options);

        mediaRecorder.ondataavailable = event => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
               // console.log(`Received audio chunk: ${event.data.size} bytes`);
            }
        };

        mediaRecorder.onstop = () => {
            console.log("MediaRecorder stopped.");
            if (audioChunks.length === 0) {
                 console.warn("No audio chunks recorded.");
                 ui.setRecordingStatus('recStatusEmpty', 'warning', {}, i18n_t);
                 // Reset state even if empty
                 isRecording = false;
                 ui.updateButtonStates(isMonitoring, isRecording, mediaRecorderSupported, i18n_t);
                 ui.hidePlayback();
                 return;
            }

            const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
            const audioUrl = URL.createObjectURL(audioBlob);

            console.log(`Blob created: Size=${audioBlob.size}, Type=${audioBlob.type}`);
            ui.displayPlayback(audioUrl, audioBlob); // Pass blob for potential info display
            ui.showRecordingSection(true);
            ui.setRecordingStatus('recStatusFinished', 'success', {
                size: formatBytes(audioBlob.size), // Utility function needed
                type: audioBlob.type || 'N/A'
            }, i18n_t);

            isRecording = false;
            ui.updateButtonStates(isMonitoring, isRecording, mediaRecorderSupported, i18n_t);
            audioChunks = []; // Clear chunks after processing
        };

        mediaRecorder.onerror = (event) => {
            console.error('MediaRecorder error:', event.error);
            ui.setRecordingStatus('recStatusError', 'error', { errorName: event.error.name }, i18n_t);
            isRecording = false;
            ui.updateButtonStates(isMonitoring, isRecording, mediaRecorderSupported, i18n_t);
            ui.hidePlayback();
        };

        mediaRecorder.start();
        console.log("MediaRecorder started.");
        isRecording = true;
        ui.setRecordingStatus('recStatusRecording', 'info', {}, i18n_t);
        ui.hidePlayback(); // Hide player while recording
        ui.showRecordingSection(true);
        ui.updateButtonStates(isMonitoring, isRecording, mediaRecorderSupported, i18n_t);

    } catch (err) {
        console.error('Error starting recording:', err);
        ui.setRecordingStatus('recStatusErrorStart', 'error', { errorName: err.name }, i18n_t);
        isRecording = false; // Ensure state is reset
        ui.updateButtonStates(isMonitoring, isRecording, mediaRecorderSupported, i18n_t);
    }
}

/**
 * Stops the current audio recording.
 * @param {function} i18n_t - Translation function.
 */
export function stopRecording(i18n_t) {
    if (!isRecording || !mediaRecorder || mediaRecorder.state === 'inactive') {
        console.log("Stop recording called but not recording or recorder inactive.");
        return;
    }

    ui.setRecordingStatus('recStatusStopping', 'info', {}, i18n_t);
    try {
        mediaRecorder.stop(); // This will trigger the 'onstop' event handler asynchronously
        console.log("MediaRecorder stop() called.");
        // State changes (button text, flags) are handled in onstop
    } catch (err) {
         console.error("Error calling MediaRecorder.stop():", err);
         ui.setRecordingStatus('recStatusErrorStop', 'error', { errorName: err.name }, i18n_t);
         // Manually reset state if stop fails badly
         isRecording = false;
         ui.updateButtonStates(isMonitoring, isRecording, mediaRecorderSupported, i18n_t);
         ui.hidePlayback();
    }
}

// --- Utility ---
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}
