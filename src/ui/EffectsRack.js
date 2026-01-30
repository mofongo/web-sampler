/**
 * Poly-Sampler Rack 2026 - Effects Rack UI
 */
import { audioEngine } from '../audio/audioEngine';

export class EffectsRack {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.render();
    }

    render() {
        this.container.innerHTML = `
            <div class="effects-rack-inner">
                <div class="effect-slot">
                    <div class="effect-header">
                        <span class="effect-title">DELAY</span>
                    </div>
                    <div class="effect-controls">
                        <div class="param-item">
                            <label class="label-tiny">Time <span class="delay-time-display">0.30</span>s</label>
                            <input type="range" class="delay-time" min="0.05" max="1.0" step="0.01" value="0.3">
                        </div>
                        <div class="param-item">
                            <label class="label-tiny">Feedback <span class="delay-feedback-display">40</span>%</label>
                            <input type="range" class="delay-feedback" min="0" max="0.9" step="0.01" value="0.4">
                        </div>
                        <div class="param-item">
                            <label class="label-tiny">Mix <span class="delay-mix-display">30</span>%</label>
                            <input type="range" class="delay-mix" min="0" max="1" step="0.01" value="0.3">
                        </div>
                    </div>
                </div>
                <div class="effect-slot">
                    <div class="effect-header">
                        <span class="effect-title">REVERB</span>
                    </div>
                    <div class="effect-controls">
                        <div class="param-item">
                            <label class="label-tiny">Decay <span class="reverb-decay-display">2.0</span></label>
                            <input type="range" class="reverb-decay" min="0.5" max="5" step="0.1" value="2">
                        </div>
                        <div class="param-item">
                            <label class="label-tiny">Mix <span class="reverb-mix-display">30</span>%</label>
                            <input type="range" class="reverb-mix" min="0" max="1" step="0.01" value="0.3">
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.setupListeners();
    }

    setupListeners() {
        // Delay controls
        const delayTime = this.container.querySelector('.delay-time');
        const delayTimeDisplay = this.container.querySelector('.delay-time-display');
        delayTime.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            audioEngine.setDelayTime(value);
            delayTimeDisplay.textContent = value.toFixed(2);
            window.dispatchEvent(new CustomEvent('slot-state-changed'));
        });

        const delayFeedback = this.container.querySelector('.delay-feedback');
        const delayFeedbackDisplay = this.container.querySelector('.delay-feedback-display');
        delayFeedback.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            audioEngine.setDelayFeedback(value);
            delayFeedbackDisplay.textContent = Math.round(value * 100);
            window.dispatchEvent(new CustomEvent('slot-state-changed'));
        });

        const delayMix = this.container.querySelector('.delay-mix');
        const delayMixDisplay = this.container.querySelector('.delay-mix-display');
        delayMix.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            audioEngine.setDelayMix(value);
            delayMixDisplay.textContent = Math.round(value * 100);
            window.dispatchEvent(new CustomEvent('slot-state-changed'));
        });

        // Reverb controls
        const reverbDecay = this.container.querySelector('.reverb-decay');
        const reverbDecayDisplay = this.container.querySelector('.reverb-decay-display');
        reverbDecay.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            audioEngine.setReverbDecay(value);
            reverbDecayDisplay.textContent = value.toFixed(1);
            window.dispatchEvent(new CustomEvent('slot-state-changed'));
        });

        const reverbMix = this.container.querySelector('.reverb-mix');
        const reverbMixDisplay = this.container.querySelector('.reverb-mix-display');
        reverbMix.addEventListener('input', (e) => {
            const value = parseFloat(e.target.value);
            audioEngine.setReverbMix(value);
            reverbMixDisplay.textContent = Math.round(value * 100);
            window.dispatchEvent(new CustomEvent('slot-state-changed'));
        });
    }

    getState() {
        return audioEngine.getEffectsParams();
    }

    setState(state) {
        if (!state) return;

        if (state.delayTime !== undefined) {
            audioEngine.setDelayTime(state.delayTime);
            this.container.querySelector('.delay-time').value = state.delayTime;
            this.container.querySelector('.delay-time-display').textContent = state.delayTime.toFixed(2);
        }
        if (state.delayFeedback !== undefined) {
            audioEngine.setDelayFeedback(state.delayFeedback);
            this.container.querySelector('.delay-feedback').value = state.delayFeedback;
            this.container.querySelector('.delay-feedback-display').textContent = Math.round(state.delayFeedback * 100);
        }
        if (state.delayMix !== undefined) {
            audioEngine.setDelayMix(state.delayMix);
            this.container.querySelector('.delay-mix').value = state.delayMix;
            this.container.querySelector('.delay-mix-display').textContent = Math.round(state.delayMix * 100);
        }
        if (state.reverbDecay !== undefined) {
            audioEngine.setReverbDecay(state.reverbDecay);
            this.container.querySelector('.reverb-decay').value = state.reverbDecay;
            this.container.querySelector('.reverb-decay-display').textContent = state.reverbDecay.toFixed(1);
        }
        if (state.reverbMix !== undefined) {
            audioEngine.setReverbMix(state.reverbMix);
            this.container.querySelector('.reverb-mix').value = state.reverbMix;
            this.container.querySelector('.reverb-mix-display').textContent = Math.round(state.reverbMix * 100);
        }
    }
}
