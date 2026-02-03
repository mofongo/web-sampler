/**
 * Poly-Sampler Rack 2026 - Additive Synth Rack UI
 */
import { additiveSynth, FREQUENCY_PRESETS, PITCH_PRESETS } from '../audio/AdditiveSynth';

export class AdditiveSynthRack {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.render();
    }

    render() {
        // Build frequency preset options
        const freqOptions = Object.entries(FREQUENCY_PRESETS)
            .map(([id, preset]) => `<option value="${id}">${preset.name}</option>`)
            .join('');

        // Build pitch preset options
        const pitchOptions = Object.entries(PITCH_PRESETS)
            .map(([id, preset]) => `<option value="${id}" ${id === 'A2' ? 'selected' : ''}>${preset.name}</option>`)
            .join('');

        // Build harmonic sliders
        let harmonicsHtml = '';
        for (let i = 0; i < 16; i++) {
            const ratioText = FREQUENCY_PRESETS['harmonic'].ratios[i];
            harmonicsHtml += `
                <div class="harmonic-slot" data-index="${i}">
                    <div class="harmonic-header">
                        <span class="harmonic-number">${i + 1}</span>
                        <span class="harmonic-ratio" id="ratio-${i}">${ratioText}x</span>
                    </div>
                    <div class="harmonic-controls">
                        <input type="range" class="harmonic-level" data-index="${i}"
                            min="0" max="1" step="0.01" value="0" orient="vertical">
                        <select class="harmonic-mod mod-select" data-index="${i}">
                            <option value="">-</option>
                            <option value="lfo1">L1</option>
                            <option value="lfo2">L2</option>
                            <option value="lfo3">L3</option>
                            <option value="lfo4">L4</option>
                        </select>
                    </div>
                </div>
            `;
        }

        this.container.innerHTML = `
            <div class="additive-synth-inner">
                <div class="additive-header">
                    <div class="additive-title-row">
                        <span class="additive-title">ADDITIVE SYNTH</span>
                        <button class="additive-toggle" id="additive-toggle">OFF</button>
                    </div>
                    <div class="additive-controls-row">
                        <div class="param-item">
                            <label class="label-tiny">Base Pitch</label>
                            <select class="pitch-preset" id="pitch-preset">
                                ${pitchOptions}
                            </select>
                        </div>
                        <div class="param-item">
                            <label class="label-tiny">Frequency Preset</label>
                            <select class="freq-preset" id="freq-preset">
                                ${freqOptions}
                            </select>
                        </div>
                        <div class="param-item">
                            <label class="label-tiny">Master Vol <span id="master-vol-display">50</span>%</label>
                            <input type="range" class="master-vol" id="additive-master-vol"
                                min="0" max="1" step="0.01" value="0.5">
                        </div>
                        <div class="param-item">
                            <label class="label-tiny">Delay Send <span id="delay-send-display">0</span>%</label>
                            <input type="range" class="delay-send" id="additive-delay-send"
                                min="0" max="1" step="0.01" value="0">
                        </div>
                        <div class="param-item">
                            <label class="label-tiny">Reverb Send <span id="reverb-send-display">0</span>%</label>
                            <input type="range" class="reverb-send" id="additive-reverb-send"
                                min="0" max="1" step="0.01" value="0">
                        </div>
                        <div class="param-item">
                            <button class="additive-quick-btn" id="all-on">All On</button>
                            <button class="additive-quick-btn" id="all-off">All Off</button>
                        </div>
                    </div>
                </div>
                <div class="harmonics-grid">
                    ${harmonicsHtml}
                </div>
            </div>
        `;

        this.setupListeners();
    }

    setupListeners() {
        // Toggle play/stop
        const toggleBtn = this.container.querySelector('#additive-toggle');
        toggleBtn.addEventListener('click', () => {
            const playing = additiveSynth.toggle();
            toggleBtn.textContent = playing ? 'ON' : 'OFF';
            toggleBtn.classList.toggle('active', playing);
            window.dispatchEvent(new CustomEvent('slot-state-changed'));
        });

        // Pitch preset
        const pitchSelect = this.container.querySelector('#pitch-preset');
        pitchSelect.addEventListener('change', (e) => {
            const preset = PITCH_PRESETS[e.target.value];
            if (preset) {
                additiveSynth.setBaseFrequency(preset.frequency);
                window.dispatchEvent(new CustomEvent('slot-state-changed'));
            }
        });

        // Click on pitch label to reset to default (A2)
        const pitchLabel = pitchSelect.previousElementSibling;
        pitchLabel.style.cursor = 'pointer';
        pitchLabel.addEventListener('click', () => {
            pitchSelect.value = 'A2';
            additiveSynth.setBaseFrequency(PITCH_PRESETS['A2'].frequency);
            window.dispatchEvent(new CustomEvent('slot-state-changed'));
        });

        // Frequency preset
        const freqSelect = this.container.querySelector('#freq-preset');
        freqSelect.addEventListener('change', (e) => {
            additiveSynth.setFrequencyPreset(e.target.value);
            this.updateRatioDisplays();
            window.dispatchEvent(new CustomEvent('slot-state-changed'));
        });

        // Master volume
        const masterVol = this.container.querySelector('#additive-master-vol');
        const masterVolDisplay = this.container.querySelector('#master-vol-display');
        masterVol.addEventListener('input', (e) => {
            const vol = parseFloat(e.target.value);
            additiveSynth.setMasterVolume(vol);
            masterVolDisplay.textContent = Math.round(vol * 100);
            window.dispatchEvent(new CustomEvent('slot-state-changed'));
        });

        // Delay send
        const delaySend = this.container.querySelector('#additive-delay-send');
        const delaySendDisplay = this.container.querySelector('#delay-send-display');
        delaySend.addEventListener('input', (e) => {
            const level = parseFloat(e.target.value);
            additiveSynth.setDelaySend(level);
            delaySendDisplay.textContent = Math.round(level * 100);
            window.dispatchEvent(new CustomEvent('slot-state-changed'));
        });

        // Reverb send
        const reverbSend = this.container.querySelector('#additive-reverb-send');
        const reverbSendDisplay = this.container.querySelector('#reverb-send-display');
        reverbSend.addEventListener('input', (e) => {
            const level = parseFloat(e.target.value);
            additiveSynth.setReverbSend(level);
            reverbSendDisplay.textContent = Math.round(level * 100);
            window.dispatchEvent(new CustomEvent('slot-state-changed'));
        });

        // Harmonic level sliders
        this.container.querySelectorAll('.harmonic-level').forEach(slider => {
            slider.addEventListener('input', (e) => {
                const index = parseInt(e.target.dataset.index);
                const level = parseFloat(e.target.value);
                additiveSynth.setHarmonicLevel(index, level);
                window.dispatchEvent(new CustomEvent('slot-state-changed'));
            });
        });

        // Harmonic mod assignments
        this.container.querySelectorAll('.harmonic-mod').forEach(select => {
            select.addEventListener('change', (e) => {
                const index = parseInt(e.target.dataset.index);
                additiveSynth.setModAssignment(index, e.target.value);
                window.dispatchEvent(new CustomEvent('slot-state-changed'));
            });
        });

        // Quick buttons
        const allOnBtn = this.container.querySelector('#all-on');
        allOnBtn.addEventListener('click', () => {
            this.container.querySelectorAll('.harmonic-level').forEach((slider, i) => {
                // Set decreasing levels for natural falloff
                const level = 1 / (i + 1);
                slider.value = level;
                additiveSynth.setHarmonicLevel(i, level);
            });
            window.dispatchEvent(new CustomEvent('slot-state-changed'));
        });

        const allOffBtn = this.container.querySelector('#all-off');
        allOffBtn.addEventListener('click', () => {
            this.container.querySelectorAll('.harmonic-level').forEach((slider, i) => {
                slider.value = 0;
                additiveSynth.setHarmonicLevel(i, 0);
            });
            window.dispatchEvent(new CustomEvent('slot-state-changed'));
        });
    }

    updateRatioDisplays() {
        const preset = FREQUENCY_PRESETS[additiveSynth.frequencyPreset];
        preset.ratios.forEach((ratio, i) => {
            const display = this.container.querySelector(`#ratio-${i}`);
            if (display) {
                display.textContent = `${ratio}x`;
            }
        });
    }

    getState() {
        return additiveSynth.getState();
    }

    setState(state) {
        if (!state) return;

        additiveSynth.setState(state);

        // Update UI to match state
        if (state.frequencyPreset) {
            const freqSelect = this.container.querySelector('#freq-preset');
            freqSelect.value = state.frequencyPreset;
            this.updateRatioDisplays();
        }

        if (state.baseFrequency) {
            // Find matching pitch preset
            const pitchSelect = this.container.querySelector('#pitch-preset');
            for (const [id, preset] of Object.entries(PITCH_PRESETS)) {
                if (Math.abs(preset.frequency - state.baseFrequency) < 0.1) {
                    pitchSelect.value = id;
                    break;
                }
            }
        }

        if (state.masterVolume !== undefined) {
            const masterVol = this.container.querySelector('#additive-master-vol');
            const masterVolDisplay = this.container.querySelector('#master-vol-display');
            masterVol.value = state.masterVolume;
            masterVolDisplay.textContent = Math.round(state.masterVolume * 100);
        }

        if (state.delaySendLevel !== undefined) {
            const delaySend = this.container.querySelector('#additive-delay-send');
            const delaySendDisplay = this.container.querySelector('#delay-send-display');
            delaySend.value = state.delaySendLevel;
            delaySendDisplay.textContent = Math.round(state.delaySendLevel * 100);
        }

        if (state.reverbSendLevel !== undefined) {
            const reverbSend = this.container.querySelector('#additive-reverb-send');
            const reverbSendDisplay = this.container.querySelector('#reverb-send-display');
            reverbSend.value = state.reverbSendLevel;
            reverbSendDisplay.textContent = Math.round(state.reverbSendLevel * 100);
        }

        if (state.harmonicLevels) {
            state.harmonicLevels.forEach((level, i) => {
                const slider = this.container.querySelector(`.harmonic-level[data-index="${i}"]`);
                if (slider) slider.value = level;
            });
        }

        if (state.modAssignments) {
            state.modAssignments.forEach((lfoId, i) => {
                const select = this.container.querySelector(`.harmonic-mod[data-index="${i}"]`);
                if (select) select.value = lfoId || '';
            });
        }

        const toggleBtn = this.container.querySelector('#additive-toggle');
        toggleBtn.textContent = state.isPlaying ? 'ON' : 'OFF';
        toggleBtn.classList.toggle('active', state.isPlaying);
    }
}
