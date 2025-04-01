// js/analyzer.js

// --- Module Scope Variables ---
let audioContext; // The main AudioContext
let analyserNode; // The AnalyserNode for getting data
let mediaStreamSource; // The source node from the microphone stream
let microphoneStream; // The raw MediaStream from getUserMedia
let mediaRecorder; // The MediaRecorder instance for recording
let recordedChunks = []; // Array to store recorded audio blobs
let silenceThreshold = -50; // dBFS threshold for detecting silence
let recordingDuration = 5000; // ms (5 seconds)
let recordingTimerId; // To store the setTimeout ID for stopping recording
let animationFrameId; // ID for the analysis loop

// --- Constants ---
const FFT_SIZE = 2048; // Frequency analysis detail (power of 2)

// --- Core Functions ---

/**
 * Initializes microphone access and sets up the Web Audio API nodes.
 * @returns {Promise<{audioContext: AudioContext, analyserNode: AnalyserNode, streamInfo: {sampleRate: number, channelCount: number}}>}
 * @throws {Error} If microphone access fails or is denied.
 */
const initMic = async () => {
    console.log("Initializing microphone...");
    if (audioContext) {
        console.warn("AudioContext already initialized.");
        // Optionally close existing context before creating a new one if re-init is needed
        // await audioContext.close();
        // audioContext = null;
        // Or simply return the existing setup
        // return { audioContext, analyserNode, streamInfo: { sampleRate: audioContext.sampleRate, channelCount: mediaStreamSource?.channelCount || 0 } };
    }

    try {
        // Request microphone access
        microphoneStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                // Optional constraints (can sometimes help, but can also cause issues)
                // echoCancellation: false,
                // noiseSuppression: false,
                // autoGainControl: false
            },
            video: false
        });
        console.log("Microphone access granted.");

        // Create AudioContext and Nodes
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyserNode = audioContext.createAnalyser();
        analyserNode.fftSize = FFT_SIZE;
        // analyserNode.smoothingTimeConstant = 0.8; // Optional smoothing

        mediaStreamSource = audioContext.createMediaStreamSource(microphoneStream);

        // Connect the source to the analyser
        mediaStreamSource.connect(analyserNode);
        // **Important:** Do NOT connect analyserNode to audioContext.destination
        // unless you want microphone passthrough to speakers.

        console.log("AudioContext and AnalyserNode created.");
        console.log("Sample Rate:", audioContext.sampleRate);
        console.log("Source Channel Count:", mediaStreamSource.channelCount);

        // Prepare for recording if supported
        if (window.MediaRecorder && MediaRecorder.isTypeSupported('audio/webm')) {
             mediaRecorder = new MediaRecorder(microphoneStream, { mimeType: 'audio/webm' });
             setupMediaRecorderListeners(mediaRecorder);
             console.log("MediaRecorder initialized.");
        } else {
            console.warn("MediaRecorder API or audio/webm not supported. Recording disabled.");
            mediaRecorder = null; // Ensure it's null if not supported
        }


        return {
            audioContext,
            analyserNode,
            streamInfo: {
                sampleRate: audioContext.sampleRate,
                channelCount: mediaStreamSource.channelCount
            }
        };

    } catch (err) {
        console.error("Error initializing microphone:", err.name, err.message);
        // Specific error handling based on err.name
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            throw new Error("PermissionDenied");
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            throw new Error("NotFound");
        } else {
            throw new Error(`InitError: ${err.message}`);
        }
    }
};

/**
 * Starts the real-time audio analysis loop.
 * Requires initMic() to have been called successfully.
 * @param {function} onMetricsUpdate - Callback function to receive metrics data.
 * @param {function} onVisualizationUpdate - Callback function to receive visualization data.
 */
const startAnalysis = (onMetricsUpdate, onVisualizationUpdate) => {
    if (!analyserNode || !audioContext || audioContext.state === 'closed') {
        console.error("Analysis cannot start: AudioContext not ready or closed.");
        return;
    }
    if (animationFrameId) {
        console.warn("Analysis loop already running.");
        return;
    }

    console.log("Starting analysis loop...");

    // Ensure context is running (it might be suspended initially)
    if (audioContext.state === 'suspended') {
        audioContext.resume();
    }

    const timeDataArray = new Uint8Array(analyserNode.fftSize); // For time-domain data (waveform)
    const frequencyDataArray = new Uint8Array(analyserNode.frequencyBinCount); // For frequency data

    let lastNoiseLevel = -Infinity; // Initialize noise level tracking

    const processAudioLoop = () => {
        if (!analyserNode) { // Check if analyserNode still exists
             console.warn("AnalyserNode missing, stopping loop.");
             stopAnalysis(); // Ensure loop stops if context closes unexpectedly
             return;
        }

        // Get data
        analyserNode.getByteTimeDomainData(timeDataArray);
        analyserNode.getByteFrequencyData(frequencyDataArray);

        // --- Calculate Metrics ---
        let peakLinear = 0;
        let sumSquares = 0;
        let sumValues = 0; // For DC offset
        let clipping = false;

        for (let i = 0; i < timeDataArray.length; i++) {
            const valueByte = timeDataArray[i];
            // Convert byte value [0, 255] to float [-1.0, 1.0]
            const valueFloat = (valueByte / 128.0) - 1.0;

            peakLinear = Math.max(peakLinear, Math.abs(valueFloat));
            sumSquares += valueFloat * valueFloat;
            sumValues += valueFloat;

            // Check for clipping (close to max/min byte values)
            if (valueByte >= 254 || valueByte <= 1) {
                clipping = true;
            }
        }

        const rmsLinear = Math.sqrt(sumSquares / timeDataArray.length);
        const dcOffset = sumValues / timeDataArray.length;

        // Convert linear amplitude [0, 1] to dBFS
        // Avoid log10(0) by handling silence or near-silence
        const peakDBFS = peakLinear > 0 ? 20 * Math.log10(peakLinear) : -Infinity;
        const rmsDBFS = rmsLinear > 0 ? 20 * Math.log10(rmsLinear) : -Infinity;

        // Silence Detection & Noise Level Estimation
        const isSilent = rmsDBFS < silenceThreshold;
        if (isSilent) {
            // Update noise level only if it's higher than the last measured silence
            // This provides a basic "peak hold" for noise during quiet periods
            lastNoiseLevel = Math.max(lastNoiseLevel, rmsDBFS);
        }
        // Reset noise level if significant sound occurs (optional, prevents holding old noise levels too long)
        // if (!isSilent && rmsDBFS > silenceThreshold + 10) { // e.g., 10dB above threshold
        //     lastNoiseLevel = -Infinity;
        // }

        const metrics = {
            peakVolume: isFinite(peakDBFS) ? peakDBFS : -100.0, // Use a floor value for display
            rmsVolume: isFinite(rmsDBFS) ? rmsDBFS : -100.0,
            clipping: clipping,
            isSilent: isSilent,
            noiseLevel: isFinite(lastNoiseLevel) ? lastNoiseLevel : -100.0,
            dcOffset: dcOffset,
            // Sample rate and channels are usually static, passed initially
        };

        // --- Callbacks for UI updates ---
        if (typeof onMetricsUpdate === 'function') {
            onMetricsUpdate(metrics);
        }
        if (typeof onVisualizationUpdate === 'function') {
            // Pass copies of the arrays if the UI might hold onto them
            onVisualizationUpdate(timeDataArray, frequencyDataArray);
        }

        // --- Continue Loop ---
        animationFrameId = requestAnimationFrame(processAudioLoop);
    };

    // Start the loop
    animationFrameId = requestAnimationFrame(processAudioLoop);
};

/**
 * Stops the real-time audio analysis loop.
 */
const stopAnalysis = () => {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
        console.log("Analysis loop stopped.");
    } else {
        console.log("Analysis loop already stopped.");
    }
};

/**
 * Starts recording audio for a fixed duration.
 * @param {function} onRecordingStart - Callback when recording actually starts.
 * @param {function} onRecordingStop - Callback with the blob URL when recording finishes.
 * @param {function} onError - Callback for recording errors.
 */
const startRecording = (onRecordingStart, onRecordingStop, onError) => {
    if (!mediaRecorder) {
        console.error("MediaRecorder not available.");
        if (typeof onError === 'function') onError("RecordingNotSupported");
        return;
    }
    if (mediaRecorder.state === 'recording') {
        console.warn("Already recording.");
        return;
    }

    recordedChunks = []; // Clear previous chunks
    mediaRecorder.start();
    console.log("Recording started (state:", mediaRecorder.state, ")");

    if (typeof onRecordingStart === 'function') onRecordingStart();

    // Set timer to stop recording automatically
    clearTimeout(recordingTimerId); // Clear any previous timer
    recordingTimerId = setTimeout(() => {
        stopRecording(onRecordingStop, onError);
    }, recordingDuration);
};

/**
 * Stops the current recording manually or via timer.
 * @param {function} onRecordingStop - Callback with the blob URL when recording finishes.
 * @param {function} onError - Callback for recording errors.
 */
const stopRecording = (onRecordingStop, onError) => {
     if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        console.log("Recorder not active or not available.");
        // It might have been stopped by the timer already, which is fine.
        // If called manually before timer, clear the timer:
        clearTimeout(recordingTimerId);
        return;
    }

    console.log("Stopping recording...");
    // The 'stop' event listener (setupMediaRecorderListeners) will handle blob creation
    mediaRecorder.stop();
    // Store callbacks to be used in the 'onstop' handler
    mediaRecorder._onRecordingStopCallback = onRecordingStop;
    mediaRecorder._onErrorCallback = onError;
};

/**
 * Sets up event listeners for the MediaRecorder instance.
 * @param {MediaRecorder} recorder
 */
const setupMediaRecorderListeners = (recorder) => {
     recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
            recordedChunks.push(event.data);
            console.log("Received chunk size:", event.data.size);
        } else {
             console.log("Received empty chunk.");
        }
    };

    recorder.onstop = () => {
        console.log("Recording stopped (state:", recorder.state, "). Chunks collected:", recordedChunks.length);
        clearTimeout(recordingTimerId); // Ensure timer is cleared

        if (recordedChunks.length === 0) {
            console.warn("No audio data recorded.");
             if (typeof recorder._onErrorCallback === 'function') recorder._onErrorCallback("NoDataRecorded");
            // Clean up callbacks
            recorder._onRecordingStopCallback = null;
            recorder._onErrorCallback = null;
            return;
        }

        // Combine chunks into a single Blob
        const blob = new Blob(recordedChunks, { type: recorder.mimeType || 'audio/webm' });
        const blobUrl = URL.createObjectURL(blob);
        console.log("Blob created:", blob.size, "URL:", blobUrl);

        // Call the success callback passed to stopRecording
        if (typeof recorder._onRecordingStopCallback === 'function') {
            recorder._onRecordingStopCallback(blobUrl);
        }

        // Clean up chunks and callbacks
        recordedChunks = [];
        recorder._onRecordingStopCallback = null;
        recorder._onErrorCallback = null;
    };

    recorder.onerror = (event) => {
        console.error("MediaRecorder error:", event.error);
        clearTimeout(recordingTimerId); // Ensure timer is cleared
         if (typeof recorder._onErrorCallback === 'function') {
             recorder._onErrorCallback(`RecorderError: ${event.error.name || event.error.message || 'Unknown error'}`);
         }
         // Clean up callbacks
        recorder._onRecordingStopCallback = null;
        recorder._onErrorCallback = null;
    };
}


/**
 * Cleans up resources (AudioContext, stream tracks).
 */
const cleanup = async () => {
    console.log("Cleaning up audio resources...");
    stopAnalysis(); // Stop analysis loop
    clearTimeout(recordingTimerId); // Clear any pending recording timer

    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop(); // Ensure recorder is stopped
    }
    mediaRecorder = null; // Remove reference

    if (microphoneStream) {
        microphoneStream.getTracks().forEach(track => track.stop());
        microphoneStream = null;
        console.log("Microphone stream tracks stopped.");
    }

    if (mediaStreamSource) {
        mediaStreamSource.disconnect();
        mediaStreamSource = null;
    }
    analyserNode = null; // Remove reference (no disconnect needed after source is gone)

    if (audioContext && audioContext.state !== 'closed') {
        try {
            await audioContext.close();
            audioContext = null;
            console.log("AudioContext closed.");
        } catch (err) {
            console.error("Error closing AudioContext:", err);
        }
    }
    // Note: Blob URLs created by createObjectURL should ideally be revoked
    // using URL.revokeObjectURL(blobUrl) when they are no longer needed (e.g., after playback).
    // This needs to be handled in the UI logic where the URL is used.
};

// --- Expose Public Methods ---
// This pattern makes it clear what functions are intended for external use.
window.MicAnalyzer = {
    initMic,
    startAnalysis,
    stopAnalysis,
    startRecording,
    stopRecording, // Expose manual stop if needed, though timer is primary
    cleanup
};
