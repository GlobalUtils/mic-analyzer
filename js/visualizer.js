// js/visualizer.js
import { uiElements } from './ui.js';

let waveformCtx = null;
let frequencyCtx = null;

/**
 * Initializes the canvas contexts.
 */
export function initVisualizer() {
    const waveformCanvas = uiElements.waveformCanvas();
    const frequencyCanvas = uiElements.frequencyCanvas();
    if (waveformCanvas && frequencyCanvas) {
        waveformCtx = waveformCanvas.getContext('2d');
        frequencyCtx = frequencyCanvas.getContext('2d');
    } else {
        console.error("Could not get canvas contexts.");
    }
}

/**
 * Clears both visualization canvases.
 */
export function clearVisualizations() {
    if (!waveformCtx || !frequencyCtx) {
        // Try to get contexts again if they weren't ready initially
        initVisualizer();
        if (!waveformCtx || !frequencyCtx) return; // Still not ready, exit
    }
    const waveformCanvas = uiElements.waveformCanvas();
    const frequencyCanvas = uiElements.frequencyCanvas();
    const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim();

    waveformCtx.fillStyle = bgColor;
    waveformCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);
    frequencyCtx.fillStyle = bgColor;
    frequencyCtx.fillRect(0, 0, frequencyCanvas.width, frequencyCanvas.height);
}

/**
 * Draws the waveform visualization.
 * @param {Uint8Array} timeData - The time domain data from the AnalyserNode.
 * @param {number} bufferLength - The length of the data buffer.
 */
function drawWaveform(timeData, bufferLength) {
    if (!waveformCtx) return;
    const canvas = uiElements.waveformCanvas();
    const width = canvas.width;
    const height = canvas.height;

    const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim();
    const lineColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();

    waveformCtx.fillStyle = bgColor;
    waveformCtx.fillRect(0, 0, width, height);
    waveformCtx.lineWidth = 2;
    waveformCtx.strokeStyle = lineColor;
    waveformCtx.beginPath();

    const sliceWidth = width * 1.0 / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
        const v = timeData[i] / 128.0; // Normalize to 0-2 range
        const y = v * height / 2;

        if (i === 0) {
            waveformCtx.moveTo(x, y);
        } else {
            waveformCtx.lineTo(x, y);
        }
        x += sliceWidth;
    }

    waveformCtx.lineTo(width, height / 2); // Line to the end center
    waveformCtx.stroke();
}

/**
 * Draws the frequency spectrum visualization.
 * @param {Uint8Array} freqData - The frequency data from the AnalyserNode.
 * @param {number} bufferLength - The length of the data buffer.
 */
function drawFrequencySpectrum(freqData, bufferLength) {
    if (!frequencyCtx) return;
    const canvas = uiElements.frequencyCanvas();
    const width = canvas.width;
    const height = canvas.height;

    const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg').trim();
    const barColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim();

    frequencyCtx.fillStyle = bgColor;
    frequencyCtx.fillRect(0, 0, width, height);

    const barWidth = (width / bufferLength) * 1.5; // Adjust multiplier for bar thickness/spacing
    let barHeight;
    let x = 0;

    frequencyCtx.fillStyle = barColor;

    for (let i = 0; i < bufferLength; i++) {
        barHeight = freqData[i] * (height / 255.0); // Scale height based on max value 255

        // Draw bars from the bottom up
        frequencyCtx.fillRect(x, height - barHeight, barWidth, barHeight);

        x += barWidth + 1; // Add 1 for spacing between bars
    }
}

/**
 * Main drawing function called in the animation loop.
 * @param {AnalyserNode} analyserNode - The audio analyser node.
 * @param {Uint8Array} timeDomainData - Array to hold time domain data.
 * @param {Uint8Array} frequencyData - Array to hold frequency data.
 * @returns {number} The calculated peak volume level (0-1).
 */
export function draw(analyserNode, timeDomainData, frequencyData) {
    if (!analyserNode || !timeDomainData || !frequencyData) return 0;

    const bufferLength = analyserNode.frequencyBinCount;

    // Get data
    analyserNode.getByteTimeDomainData(timeDomainData);
    analyserNode.getByteFrequencyData(frequencyData);

    // Calculate Volume (simple peak calculation)
    let peak = 0;
    for (let i = 0; i < bufferLength; i++) {
        const value = Math.abs(timeDomainData[i] / 128.0 - 1.0); // Normalize to 0-1 range
        if (value > peak) {
            peak = value;
        }
    }

    // Draw visualizations
    drawWaveform(timeDomainData, bufferLength);
    drawFrequencySpectrum(frequencyData, bufferLength);

    return peak; // Return volume level for UI update
}
