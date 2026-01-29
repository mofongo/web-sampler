# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Poly-Sampler Rack 2026 is a browser-based audio sampler application built with vanilla JavaScript and Vite. It allows users to load audio samples into multiple slots, manipulate them with filters and effects, and modulate parameters using global LFOs.

## Commands

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Architecture

### Core Components

**Audio Layer (`src/audio/`)**
- `audioEngine.js` - Singleton audio engine managing Web Audio API context, master gain, limiter, and 4 global LFOs. Exports `audioEngine` instance. Handles sample decoding and storage in a global library Map.
- `Voice.js` - Individual sample playback voice with lowpass filter, panner, ADSR envelope, and loop points. Supports LFO modulation assignments for pitch, cutoff, volume, and loop start position.

**UI Layer (`src/ui/`)**
- `PlayerUI.js` - Per-slot UI component that owns a Voice instance. Integrates WaveSurfer.js for waveform display with regions plugin for visual loop selection. Handles drag-drop sample loading.
- `LFORack.js` - Global LFO control panel with canvas-based oscilloscope visualizations.

### Data Flow

1. Audio engine initializes on first user interaction (click/mousedown)
2. Samples are loaded via drag-drop onto slots or from default presets
3. LFOs run on requestAnimationFrame loop, dispatching `lfo-update` window events
4. Voices subscribe to `lfo-update` events to apply real-time modulation
5. WaveSurfer regions sync bidirectionally with Voice loop parameters

### Key Patterns

- **Global Event Bus**: Custom events (`lfo-update`, `new-sample-loaded`) for cross-component communication
- **State Serialization**: `getState()`/`setState()` methods on PlayerUI for export/import functionality
- **Voice Stealing**: Re-triggering a voice stops the previous instance with fade-out before starting new playback

### Entry Points

- `index.html` - Main HTML with header controls, sampler rack container, LFO rack, and status bar
- `main.js` (root) - Application bootstrap, slot management, master volume, project import/export
- `style.css` - Full styling with CSS custom properties for theming

### External Dependencies

- **wavesurfer.js** - Waveform visualization and region selection
- **Vite** - Build tooling and dev server
