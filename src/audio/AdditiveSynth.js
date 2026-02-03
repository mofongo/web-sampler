/**
 * Poly-Sampler Rack 2026 - Additive Synthesizer
 * 16 sine wave oscillators with individual amplitude control and LFO modulation
 */
import { audioEngine } from './audioEngine';

// Frequency ratio presets
export const FREQUENCY_PRESETS = {
    'harmonic': {
        name: 'Harmonic Series',
        ratios: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]
    },
    'odd': {
        name: 'Odd Harmonics',
        ratios: [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31]
    },
    'organ': {
        name: 'Organ Drawbars',
        ratios: [0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32, 64]
    },
    'just-major': {
        name: 'Just Major',
        ratios: [1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32]
    },
    'just-minor': {
        name: 'Just Minor',
        ratios: [1, 1.2, 1.5, 2, 2.4, 3, 4, 4.8, 6, 8, 9.6, 12, 16, 19.2, 24, 32]
    },
    'fifths': {
        name: 'Fifths Stack',
        ratios: [1, 1.5, 2.25, 3, 3.375, 4.5, 6, 6.75, 9, 12, 13.5, 18, 24, 27, 36, 48]
    },
    'bell': {
        name: 'Bell/Metallic',
        ratios: [1, 1.414, 2, 2.236, 2.828, 3.162, 3.606, 4, 4.472, 5, 5.657, 6.325, 7.07, 8, 9, 10]
    },
    'subharmonic': {
        name: 'Subharmonics',
        ratios: [0.25, 0.333, 0.5, 0.667, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32]
    }
};

// Base pitch presets (in Hz)
export const PITCH_PRESETS = {
    'C1': { name: 'C1 (32.7 Hz)', frequency: 32.70 },
    'C2': { name: 'C2 (65.4 Hz)', frequency: 65.41 },
    'A2': { name: 'A2 (110 Hz)', frequency: 110.00 },
    'C3': { name: 'C3 (130.8 Hz)', frequency: 130.81 },
    'A3': { name: 'A3 (220 Hz)', frequency: 220.00 },
    'C4': { name: 'C4 (261.6 Hz)', frequency: 261.63 },
    'A4': { name: 'A4 (440 Hz)', frequency: 440.00 }
};

export class AdditiveSynth {
    constructor() {
        this.oscillators = [];
        this.gains = [];
        this.masterGain = null;
        this.isPlaying = false;
        this.baseFrequency = 110; // A2 default
        this.frequencyPreset = 'harmonic';
        this.harmonicLevels = new Array(16).fill(0); // All off by default
        this.modAssignments = new Array(16).fill(null); // LFO assignments per harmonic
        this.masterVolume = 0.5;

        this.init();
    }

    init() {
        if (!audioEngine.initialized) return;

        const ctx = audioEngine.context;

        // Master gain for the synth
        this.masterGain = ctx.createGain();
        this.masterGain.gain.setValueAtTime(0, ctx.currentTime);
        this.masterGain.connect(audioEngine.masterGain);

        // Also connect to delay/reverb sends
        const delaySend = ctx.createGain();
        delaySend.gain.setValueAtTime(0.3, ctx.currentTime);
        this.masterGain.connect(delaySend);
        delaySend.connect(audioEngine.delayInput);

        const reverbSend = ctx.createGain();
        reverbSend.gain.setValueAtTime(0.2, ctx.currentTime);
        this.masterGain.connect(reverbSend);
        reverbSend.connect(audioEngine.reverbInput);

        // Create 16 oscillators
        for (let i = 0; i < 16; i++) {
            const osc = ctx.createOscillator();
            osc.type = 'sine';

            const gain = ctx.createGain();
            gain.gain.setValueAtTime(0, ctx.currentTime);

            osc.connect(gain);
            gain.connect(this.masterGain);

            osc.start();

            this.oscillators.push(osc);
            this.gains.push(gain);
        }

        this.updateFrequencies();

        // Apply any stored harmonic levels
        this.gains.forEach((gain, i) => {
            gain.gain.setValueAtTime(this.harmonicLevels[i] * this.masterVolume, ctx.currentTime);
        });

        // Listen for LFO updates
        window.addEventListener('lfo-update', () => this.applyModulation());
    }

    ensureInit() {
        if (!this.masterGain && audioEngine.initialized) {
            this.init();
        }
    }

    updateFrequencies() {
        if (!audioEngine.initialized) return;

        const preset = FREQUENCY_PRESETS[this.frequencyPreset];
        const ctx = audioEngine.context;

        this.oscillators.forEach((osc, i) => {
            const freq = this.baseFrequency * preset.ratios[i];
            osc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.01);
        });
    }

    setBaseFrequency(freq) {
        this.baseFrequency = freq;
        this.updateFrequencies();
    }

    setFrequencyPreset(presetId) {
        this.frequencyPreset = presetId;
        this.updateFrequencies();
    }

    setHarmonicLevel(index, level) {
        if (index < 0 || index >= 16) return;
        this.harmonicLevels[index] = level;

        if (!audioEngine.initialized || !this.gains[index]) return;

        const ctx = audioEngine.context;
        this.gains[index].gain.setTargetAtTime(level * this.masterVolume, ctx.currentTime, 0.02);
    }

    setModAssignment(index, lfoId) {
        if (index < 0 || index >= 16) return;
        this.modAssignments[index] = lfoId || null;
    }

    setMasterVolume(vol) {
        this.masterVolume = vol;
        if (!audioEngine.initialized || this.gains.length === 0) return;

        const ctx = audioEngine.context;
        // Update all harmonics with new master volume
        this.gains.forEach((gain, i) => {
            gain.gain.setTargetAtTime(this.harmonicLevels[i] * vol, ctx.currentTime, 0.02);
        });
    }

    applyModulation() {
        if (!audioEngine.initialized) return;

        const ctx = audioEngine.context;
        const now = ctx.currentTime;

        this.gains.forEach((gain, i) => {
            const baseLevel = this.harmonicLevels[i];
            const lfoId = this.modAssignments[i];

            if (lfoId) {
                const lfoVal = audioEngine.getLFOValue(lfoId);
                // Modulate amplitude: map LFO (-1 to 1) to (0 to 2x base level)
                const modLevel = Math.max(0, baseLevel * (1 + lfoVal));
                gain.gain.setTargetAtTime(modLevel * this.masterVolume, now, 0.02);
            }
        });
    }

    play() {
        this.ensureInit();
        if (!audioEngine.initialized) return;

        this.isPlaying = true;
        const ctx = audioEngine.context;
        this.masterGain.gain.setTargetAtTime(1, ctx.currentTime, 0.05);
    }

    stop() {
        if (!audioEngine.initialized) return;

        this.isPlaying = false;
        const ctx = audioEngine.context;
        this.masterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    }

    toggle() {
        if (this.isPlaying) {
            this.stop();
        } else {
            this.play();
        }
        return this.isPlaying;
    }

    getState() {
        return {
            baseFrequency: this.baseFrequency,
            frequencyPreset: this.frequencyPreset,
            harmonicLevels: [...this.harmonicLevels],
            modAssignments: [...this.modAssignments],
            masterVolume: this.masterVolume,
            isPlaying: this.isPlaying
        };
    }

    setState(state) {
        if (!state) return;

        if (state.baseFrequency !== undefined) {
            this.baseFrequency = state.baseFrequency;
        }
        if (state.frequencyPreset !== undefined) {
            this.frequencyPreset = state.frequencyPreset;
        }
        if (state.masterVolume !== undefined) {
            this.masterVolume = state.masterVolume;
        }
        if (state.harmonicLevels) {
            state.harmonicLevels.forEach((level, i) => {
                this.setHarmonicLevel(i, level);
            });
        }
        if (state.modAssignments) {
            state.modAssignments.forEach((lfoId, i) => {
                this.modAssignments[i] = lfoId;
            });
        }

        this.updateFrequencies();

        if (state.isPlaying) {
            this.play();
        } else {
            this.stop();
        }
    }
}

// Singleton instance
export const additiveSynth = new AdditiveSynth();
