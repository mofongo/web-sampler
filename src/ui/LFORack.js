/**
 * Poly-Sampler Rack 2026 - Global LFO Rack UI
 */
import { audioEngine } from '../audio/audioEngine';

export class LFORack {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.history = {
            lfo1: new Array(100).fill(0),
            lfo2: new Array(100).fill(0),
            lfo3: new Array(100).fill(0),
            lfo4: new Array(100).fill(0)
        };
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
                <!-- Canvas Scope -->
                <canvas class="lfo-scope" id="scope-${lfoId}" width="200" height="40"></canvas>
                
                <div class="lfo-controls">
                    <div class="param-item">
                        <label class="label-tiny">Shape</label>
                        <select class="lfo-shape" data-lfo="${lfoId}">
                            <option value="sine">Sine</option>
                            <option value="random-square">S&H</option>
                            <option value="smooth-random">Smooth Rand</option>
                        </select>
                    </div>
                    <div class="param-item">
                        <label class="label-tiny">Speed <span class="lfo-speed-display" id="speed-${lfoId}">1.0</span> Hz</label>
                        <input type="range" class="lfo-freq" data-lfo="${lfoId}" min="0.1" max="20.0" step="0.1" value="1.0">
                    </div>
                    <div class="param-item lfo-xmod">
                        <label class="label-tiny">Freq Mod</label>
                        <div class="mod-row">
                            <select class="lfo-mod-source" data-lfo="${lfoId}" data-param="frequency">
                                <option value="">-</option>
                                ${[1,2,3,4].filter(j => j !== i).map(j => `<option value="lfo${j}">L${j}</option>`).join('')}
                            </select>
                            <input type="range" class="lfo-mod-depth" data-lfo="${lfoId}" data-param="frequency" min="0" max="1" step="0.01" value="0.5">
                        </div>
                    </div>
                    <div class="param-item lfo-xmod">
                        <label class="label-tiny">Amp Mod</label>
                        <div class="mod-row">
                            <select class="lfo-mod-source" data-lfo="${lfoId}" data-param="amplitude">
                                <option value="">-</option>
                                ${[1,2,3,4].filter(j => j !== i).map(j => `<option value="lfo${j}">L${j}</option>`).join('')}
                            </select>
                            <input type="range" class="lfo-mod-depth" data-lfo="${lfoId}" data-param="amplitude" min="0" max="1" step="0.01" value="0.5">
                        </div>
                    </div>
                </div>
            `;
            this.container.appendChild(slot);
        }

        this.setupListeners();
        this.startVisualizationLoop();
    }

    setupListeners() {
        this.container.querySelectorAll('.lfo-shape').forEach(select => {
            select.addEventListener('change', (e) => {
                const id = e.target.dataset.lfo;
                audioEngine.setLFOParams(id, { type: e.target.value });
                window.dispatchEvent(new CustomEvent('slot-state-changed'));
            });
        });

        this.container.querySelectorAll('.lfo-freq').forEach(input => {
            input.addEventListener('input', (e) => {
                const id = e.target.dataset.lfo;
                const freq = parseFloat(e.target.value);
                audioEngine.setLFOParams(id, { frequency: freq });
                const speedDisplay = document.getElementById(`speed-${id}`);
                if (speedDisplay) speedDisplay.textContent = freq.toFixed(1);
                window.dispatchEvent(new CustomEvent('slot-state-changed'));
            });
        });

        this.container.querySelectorAll('.lfo-mod-source').forEach(select => {
            select.addEventListener('change', (e) => {
                const lfoId = e.target.dataset.lfo;
                const param = e.target.dataset.param;
                audioEngine.setLFOModAssignment(lfoId, param, e.target.value || null);
                window.dispatchEvent(new CustomEvent('slot-state-changed'));
            });
        });

        this.container.querySelectorAll('.lfo-mod-depth').forEach(input => {
            input.addEventListener('input', (e) => {
                const lfoId = e.target.dataset.lfo;
                const param = e.target.dataset.param;
                audioEngine.setLFOModDepth(lfoId, param, parseFloat(e.target.value));
                window.dispatchEvent(new CustomEvent('slot-state-changed'));
            });
        });
    }

    startVisualizationLoop() {
        const draw = () => {
            requestAnimationFrame(draw);

            for (let i = 1; i <= 4; i++) {
                const lfoId = `lfo${i}`;
                const value = audioEngine.getLFOValue(lfoId);

                // Update text
                const display = document.getElementById(`val-${lfoId}`);
                if (display) display.textContent = value.toFixed(2);

                // Update Buffer
                this.history[lfoId].push(value);
                this.history[lfoId].shift();

                // Draw Scope
                const canvas = document.getElementById(`scope-${lfoId}`);
                if (canvas) {
                    const ctx = canvas.getContext('2d');
                    const w = canvas.width;
                    const h = canvas.height;
                    const buffer = this.history[lfoId];

                    ctx.clearRect(0, 0, w, h);

                    // Grid line
                    ctx.strokeStyle = '#333';
                    ctx.beginPath();
                    ctx.moveTo(0, h / 2);
                    ctx.lineTo(w, h / 2);
                    ctx.stroke();

                    // Waveform
                    ctx.strokeStyle = '#00f2ff';
                    ctx.lineWidth = 2;
                    ctx.beginPath();

                    const step = w / (buffer.length - 1);

                    buffer.forEach((val, index) => {
                        // Map -1..1 to h..0
                        const y = ((val * -1 + 1) / 2) * h;
                        const x = index * step;
                        if (index === 0) ctx.moveTo(x, y);
                        else ctx.lineTo(x, y);
                    });

                    ctx.stroke();
                }
            }
        };
        draw();
    }
}
