/**
 * Poly-Sampler Rack 2026 - Global LFO Rack UI
 */
import { audioEngine } from '../audio/audioEngine';

export class LFORack {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.render();
    }

    render() {
        this.container.innerHTML = '';
        for (let i = 1; i <= 4; i++) {
            const lfoId = `lfo${i}`;
            const slot = document.createElement('div');
            slot.className = 'lfo-slot';
            slot.innerHTML = `
                <div class="lfo-header">
                    <span class="lfo-title">LFO ${i}</span>
                    <span class="lfo-value-display" id="val-${lfoId}">0.00</span>
                </div>
                <div class="lfo-controls">
                    <div class="param-item">
                        <label class="label-tiny">Shape</label>
                        <select class="lfo-shape" data-lfo="${lfoId}">
                            <option value="sine">Sine</option>
                            <option value="random-square">Random Sq</option>
                            <option value="smooth-random">Smooth Rand</option>
                        </select>
                    </div>
                    <div class="param-item">
                        <label class="label-tiny">Speed (Hz)</label>
                        <input type="range" class="lfo-freq" data-lfo="${lfoId}" min="0.1" max="20.0" step="0.1" value="1.0">
                    </div>
                </div>
            `;
            this.container.appendChild(slot);
        }

        this.setupListeners();
        this.startValueDisplay();
    }

    setupListeners() {
        this.container.querySelectorAll('.lfo-shape').forEach(select => {
            select.addEventListener('change', (e) => {
                const id = e.target.dataset.lfo;
                audioEngine.setLFOParams(id, { type: e.target.value });
            });
        });

        this.container.querySelectorAll('.lfo-freq').forEach(input => {
            input.addEventListener('input', (e) => {
                const id = e.target.dataset.lfo;
                audioEngine.setLFOParams(id, { frequency: parseFloat(e.target.value) });
            });
        });
    }

    startValueDisplay() {
        const update = () => {
            for (let i = 1; i <= 4; i++) {
                const lfoId = `lfo${i}`;
                const display = document.getElementById(`val-${lfoId}`);
                if (display) {
                    display.textContent = audioEngine.getLFOValue(lfoId).toFixed(2);
                }
            }
            requestAnimationFrame(update);
        };
        update();
    }
}
