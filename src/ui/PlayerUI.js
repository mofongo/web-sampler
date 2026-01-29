/**
 * Poly-Sampler Rack 2026 - Player UI Component
 */
import { audioEngine } from '../audio/audioEngine';
import { Voice } from '../audio/Voice';
import WaveSurfer from 'wavesurfer.js';
import RegionsPlugin from 'wavesurfer.js/dist/plugins/regions.esm.js';

export class PlayerUI {
    constructor(id, container) {
        this.id = id;
        this.container = container;
        this.voice = new Voice(id);
        this.element = null;
        this.wavesurfer = null;
        this.regions = null;
        this.vuCanvas = null;
        this.vuCtx = null;
        this.render();
    }

    render() {
        const div = document.createElement('div');
        div.className = 'player-slot';
        div.id = `slot-${this.id}`;
        div.innerHTML = `
            <div class="slot-header">
                <span class="slot-title">SLOT ${String(this.id).padStart(2, '0')}</span>
                <select class="sample-select">
                    <option value="">- No Sample -</option>
                </select>
                <div class="slot-actions">
                    <button class="btn-icon btn-loop" title="Toggle Looping">L</button>
                    <button class="btn-icon btn-mute" title="Mute">M</button>
                    <button class="btn-icon btn-play" title="Play">▶</button>
                </div>
            </div>
            <div class="slot-main">
                <div class="vu-meter-area">
                    <div class="vu-meter-container">
                        <canvas class="vu-meter-canvas"></canvas>
                    </div>
                    <input type="range" class="param-volume vertical-slider" min="0" max="1.0" step="0.01" value="0.8" title="Volume" orient="vertical">
                </div>
                <div class="waveform-container">
                    <div class="ws-waveform"></div>
                    <div class="drop-overlay">DROP FILE</div>
                </div>
            </div>
            <div class="parameter-grid">
                <div class="param-item">
                    <label class="label-tiny">Pitch</label>
                    <div class="param-row">
                        <input type="range" class="param-pitch" min="0.5" max="2.0" step="0.01" value="1.0">
                        <select class="mod-select param-mod-pitch" title="LFO Pitch">
                            <option value="">Off</option>
                            <option value="lfo1">L1</option>
                            <option value="lfo2">L2</option>
                            <option value="lfo3">L3</option>
                            <option value="lfo4">L4</option>
                        </select>
                    </div>
                </div>
                <div class="param-item">
                    <label class="label-tiny">Cutoff</label>
                    <div class="param-row">
                        <input type="range" class="param-cutoff" min="20" max="20000" step="1" value="20000">
                        <select class="mod-select param-mod-cutoff" title="LFO Cutoff">
                            <option value="">Off</option>
                            <option value="lfo1">L1</option>
                            <option value="lfo2">L2</option>
                            <option value="lfo3">L3</option>
                            <option value="lfo4">L4</option>
                        </select>
                    </div>
                </div>
                <div class="param-item">
                    <label class="label-tiny">Pan</label>
                    <input type="range" class="param-pan" min="-1" max="1" step="0.01" value="0">
                </div>
                <div class="param-item">
                    <label class="label-tiny">Mod Vol</label>
                    <select class="mod-select param-mod-volume">
                        <option value="">Off</option>
                        <option value="lfo1">L1</option>
                        <option value="lfo2">L2</option>
                        <option value="lfo3">L3</option>
                        <option value="lfo4">L4</option>
                    </select>
                </div>
            </div>
        `;

        this.element = div;
        this.container.appendChild(div);

        this.vuCanvas = div.querySelector('.vu-meter-canvas');
        this.vuCtx = this.vuCanvas.getContext('2d');

        this.initWaveSurfer(div.querySelector('.ws-waveform'));
        this.setupListeners();
        setTimeout(() => this.resizeCanvas(), 50);
        this.startVUMeter();
    }

    initWaveSurfer(container) {
        this.wavesurfer = WaveSurfer.create({
            container: container,
            waveColor: '#00f2ff55',
            progressColor: '#00f2ff',
            cursorColor: 'transparent',
            height: 120, // Match CSS container height
            barWidth: 2,
            barGap: 1,
            interact: false,
        });

        this.regions = this.wavesurfer.registerPlugin(RegionsPlugin.create());

        this.regions.on('region-updated', (region) => {
            const duration = this.wavesurfer.getDuration();
            if (duration > 0) {
                this.voice.updateSettings({
                    loopStart: region.start / duration,
                    loopEnd: region.end / duration
                });
            }
        });

        this.regions.enableDragSelection({
            color: 'rgba(0, 242, 255, 0.2)',
        });

        this.regions.on('region-created', (region) => {
            // Remove all other regions
            this.regions.getRegions().forEach(r => {
                if (r !== region) r.remove();
            });

            const duration = this.wavesurfer.getDuration();
            if (duration > 0) {
                this.voice.updateSettings({
                    loopStart: region.start / duration,
                    loopEnd: region.end / duration
                });
            }
        });

        this.regions.on('region-clicked', () => {
            this.voice.trigger();
        });
    }

    setupListeners() {
        // Drag and Drop
        this.element.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.element.classList.add('drag-over');
        });

        this.element.addEventListener('dragleave', () => {
            this.element.classList.remove('drag-over');
        });

        this.element.addEventListener('drop', async (e) => {
            e.preventDefault();
            this.element.classList.remove('drag-over');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('audio/')) {
                await this.loadSample(file);
            }
        });

        // Play/Pause and Mute
        const playBtn = this.element.querySelector('.btn-play');
        const muteBtn = this.element.querySelector('.btn-mute');
        const loopBtn = this.element.querySelector('.btn-loop');

        playBtn.addEventListener('click', () => {
            if (this.voice.settings.loop && this.voice.activeSource) {
                this.voice.stop();
                playBtn.classList.remove('active');
            } else {
                this.voice.trigger();
                if (this.voice.settings.loop) {
                    playBtn.classList.add('active');
                }
            }
        });

        muteBtn.addEventListener('click', () => {
            const isMuted = !this.voice.isMuted;
            this.voice.setMute(isMuted);
            muteBtn.classList.toggle('active', isMuted);
            muteBtn.textContent = isMuted ? 'U' : 'M';
        });

        loopBtn.addEventListener('click', () => {
            const isLooping = !this.voice.settings.loop;
            this.voice.updateSettings({ loop: isLooping });
            loopBtn.classList.toggle('active', isLooping);
        });

        // Parameter Changes
        this.element.querySelector('.sample-select').addEventListener('change', (e) => {
            const buffer = audioEngine.getBuffer(e.target.value);
            const blob = audioEngine.getBlob(e.target.value);
            if (buffer && blob) {
                this.loadBuffer(buffer, blob);
            }
        });

        const updateVoiceParams = () => {
            this.voice.updateSettings({
                pitch: parseFloat(this.element.querySelector('.param-pitch').value),
                cutoff: parseFloat(this.element.querySelector('.param-cutoff').value),
                pan: parseFloat(this.element.querySelector('.param-pan').value),
                volume: parseFloat(this.element.querySelector('.param-volume').value),
                modAssignments: {
                    pitch: this.element.querySelector('.param-mod-pitch').value || null,
                    cutoff: this.element.querySelector('.param-mod-cutoff').value || null,
                    volume: this.element.querySelector('.param-mod-volume').value || null
                }
            });
        };

        this.element.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('input', updateVoiceParams);
            input.addEventListener('change', updateVoiceParams);
        });

        // LFO Update Listener
        window.addEventListener('lfo-update', () => {
            if (this.voice.settings.modAssignments.pitch ||
                this.voice.settings.modAssignments.cutoff ||
                this.voice.settings.modAssignments.volume) {
                this.voice.applyRealtimeParams();
            }
        });
    }

    async loadSample(file) {
        try {
            const { name, buffer, blob } = await audioEngine.decodeFile(file);
            this.loadBuffer(buffer, blob);

            // Dispatch event to global to update all menus
            window.dispatchEvent(new CustomEvent('new-sample-loaded', { detail: { name } }));
        } catch (err) {
            console.error('Error loading sample:', err);
        }
    }

    loadBuffer(buffer, blob) {
        this.voice.setBuffer(buffer);
        // Wavesurfer v7 load expects a URL or Blob
        const url = URL.createObjectURL(blob);
        this.wavesurfer.load(url);

        this.regions.clearRegions();
        this.voice.updateSettings({ loopStart: 0, loopEnd: 1.0 });
    }

    updateMenu(keys) {
        const select = this.element.querySelector('.sample-select');
        const currentValue = select.value;

        select.innerHTML = '<option value="">- No Sample -</option>';
        keys.forEach(key => {
            const option = document.createElement('option');
            option.value = key;
            option.textContent = key;
            if (key === currentValue) option.selected = true;
            select.appendChild(option);
        });
    }

    resizeCanvas() {
        const vuRect = this.vuCanvas.parentElement.getBoundingClientRect();
        if (vuRect.width > 0) {
            this.vuCanvas.width = vuRect.width;
            this.vuCanvas.height = vuRect.height;
        } else {
            // Default fallback if layout hasn't computed yet
            this.vuCanvas.width = 10;
            this.vuCanvas.height = 120;
        }
    }

    startVUMeter() {
        const drawVU = () => {
            requestAnimationFrame(drawVU);

            if (this.vuCanvas.width === 0) {
                this.resizeCanvas();
            }

            if (!this.voice.analyserNode) {
                this.vuCtx.clearRect(0, 0, this.vuCanvas.width, this.vuCanvas.height);
                return;
            }

            const bufferLength = this.voice.analyserNode.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            this.voice.analyserNode.getByteFrequencyData(dataArray);

            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
            }
            const average = sum / bufferLength;
            const level = (average / 255) * this.vuCanvas.height;

            this.vuCtx.clearRect(0, 0, this.vuCanvas.width, this.vuCanvas.height);

            const gradient = this.vuCtx.createLinearGradient(0, this.vuCanvas.height, 0, 0);
            gradient.addColorStop(0, '#00ff00');
            gradient.addColorStop(0.7, '#ffff00');
            gradient.addColorStop(1, '#ff0000');

            this.vuCtx.fillStyle = gradient;
            this.vuCtx.fillRect(0, this.vuCanvas.height - level, this.vuCanvas.width, level);
        };
        drawVU();
    }

    getState() {
        const regions = this.regions.getRegions();
        const mainRegion = regions[0];

        return {
            slotId: this.id,
            sampleKey: this.element.querySelector('.sample-select').value,
            settings: this.voice.settings,
            region: mainRegion ? { start: mainRegion.start, end: mainRegion.end } : null
        };
    }

    setState(state) {
        if (state.sampleKey) {
            const buffer = audioEngine.getBuffer(state.sampleKey);
            const blob = audioEngine.getBlob(state.sampleKey);
            if (buffer && blob) {
                this.loadBuffer(buffer, blob);
                if (state.region) {
                    setTimeout(() => {
                        this.regions.addRegion({
                            start: state.region.start,
                            end: state.region.end,
                            color: 'rgba(0, 242, 255, 0.2)'
                        });
                    }, 100);
                }
            }
            this.element.querySelector('.sample-select').value = state.sampleKey;
        }

        const settings = state.settings;
        this.element.querySelector('.param-pitch').value = settings.pitch;
        this.element.querySelector('.param-cutoff').value = settings.cutoff;
        this.element.querySelector('.param-pan').value = settings.pan || 0;
        this.element.querySelector('.param-volume').value = settings.volume || 0.8;

        if (settings.modAssignments) {
            this.element.querySelector('.param-mod-pitch').value = settings.modAssignments.pitch || '';
            this.element.querySelector('.param-mod-cutoff').value = settings.modAssignments.cutoff || '';
            this.element.querySelector('.param-mod-volume').value = settings.modAssignments.volume || '';
        }

        this.voice.updateSettings(settings);
    }
}
