# Mic Analyzer - Free Online Microphone Test

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A free, secure, and easy-to-use web-based tool to test your microphone directly in your browser. Check your mic input level, visualize the audio, and record a quick sample for playback.

**Live Tool:** [https://globalutils.github.io/mic-analyzer/](https://globalutils.github.io/mic-analyzer/)

## Features

*   **Instant Mic Check:** Quickly see if your microphone is working and picking up sound.
*   **Microphone Selection:** Choose from available audio input devices connected to your system.
*   **Real-time Volume Meter:** Visual feedback on your current input volume level.
*   **Audio Visualization:**
    *   **Waveform:** See the shape of your audio signal over time.
    *   **Frequency Spectrum:** Analyze the distribution of frequencies (low to high pitches).
*   **Recording & Playback:** Record a short audio clip and play it back to check quality.
*   **Privacy Focused:** **All audio processing happens entirely within your browser (client-side). Your audio data is never sent to or stored on any server.**
*   **No Installation Required:** Works directly in modern web browsers (Chrome, Firefox, Safari, Edge).
*   **Free to Use:** Completely free with no ads or limitations.
*   **Light/Dark Mode:** Choose your preferred theme.
*   **Multi-language Support:** Available in multiple languages (contributions welcome!).

## Why Use Mic Analyzer?

*   Troubleshoot microphone issues before online meetings (Zoom, Teams, Meet, etc.).
*   Check your headset or external microphone setup.
*   Verify microphone input levels for streaming or recording.
*   Ensure your browser has the correct microphone permissions.
*   Test microphone quality privately and securely.

## How to Use

1.  **Open the Tool:** Visit [https://globalutils.github.io/mic-analyzer/](https://globalutils.github.io/mic-analyzer/).
2.  **Grant Permission:** Your browser will ask for permission to access your microphone. Click "Allow".
3.  **Select Microphone:** Choose your desired microphone from the dropdown list.
4.  **Start Testing:** Click the "Start Testing" button.
5.  **Check Visuals:** Speak into your microphone. You should see the volume meter, waveform, and frequency spectrum react.
6.  **(Optional) Record:** Click "Record Sample", speak, then click "Stop Recording". An audio player will appear for playback.
7.  **Stop Testing:** Click "Stop Testing" when finished to release the microphone.

## Technical Details

*   Built with HTML5, CSS3, and Vanilla JavaScript.
*   Uses the Web Audio API for audio processing and analysis.
*   Uses the MediaStream Recording API for recording functionality.
*   Uses `localStorage` for theme and language preferences.
*   Client-side processing ensures user privacy.

## File Structure
