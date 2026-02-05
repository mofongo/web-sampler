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
        this.isDraggingSlider = false;
        this.isDraggingRegion = false;
        this.vuCanvas = null;
        this.vuCtx = null;

        // Zoom state
        this.zoomLevel = 0; // 0 = fit to container, higher = more zoomed
        this.minZoom = 0;
        this.maxZoom = 500; // pixels per second max
        this.lastPinchDistance = 0;
        this.isPinching = false;

        // Auto-scroll state
        this.autoScrollDirection = 0;
        this.autoScrollRAF = null;

        // Pending async operations (for cleanup)
        this._pendingOnReady = null;
        this._pendingRegionTimeout = null;

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
                    <option value="">Select a Sample</option>
                </select>
                <div class="slot-actions">
                    <button class="btn-icon btn-reverse" title="Reverse — play sample backwards">R</button>
                    <button class="btn-icon btn-loop active" title="Loop — toggle continuous looping">L</button>
                    <button class="btn-icon btn-mute" title="Mute — silence this slot">M</button>
                    <button class="btn-icon btn-play" title="Play / Stop">▶</button>
                </div>
            </div>
            <div class="slot-main">
                <div class="vu-meter-area">
                    <div class="vu-meter-container">
                        <canvas class="vu-meter-canvas"></canvas>
                    </div>
                </div>
                <div class="waveform-container">
                    <div class="ws-waveform"></div>
                    <div class="drop-overlay">DROP FILE</div>
                </div>
            </div>
            <div class="parameter-grid">
                <div class="param-box">
                    <label class="label-tiny">Pitch</label>
                    <input type="range" class="param-pitch" min="0.5" max="2.0" step="0.01" value="1.0" title="Playback speed — 0.5x (half speed) to 2.0x (double speed)">
                    <div class="mod-row">
                        <select class="mod-select param-mod-pitch" title="Assign an LFO to modulate pitch">
                            <option value="">LFO</option>
                            <option value="lfo1">L1</option>
                            <option value="lfo2">L2</option>
                            <option value="lfo3">L3</option>
                            <option value="lfo4">L4</option>
                        </select>
                        <input type="range" class="mod-depth param-depth-pitch" min="0" max="1" step="0.01" value="0.5" title="LFO modulation depth — how much the LFO affects pitch">
                    </div>
                </div>
                <div class="param-box">
                    <div class="label-row">
                        <label class="label-tiny">Filter</label>
                        <select class="param-filter-type" title="Filter type — LP (lowpass), HP (highpass), BP (bandpass), NT (notch)">
                            <option value="lowpass">LP</option>
                            <option value="highpass">HP</option>
                            <option value="bandpass">BP</option>
                            <option value="notch">NT</option>
                        </select>
                    </div>
                    <input type="range" class="param-cutoff" min="20" max="20000" step="1" value="20000" title="Filter cutoff frequency — 20 Hz to 20,000 Hz">
                    <div class="mod-row">
                        <select class="mod-select param-mod-cutoff" title="Assign an LFO to modulate filter cutoff">
                            <option value="">LFO</option>
                            <option value="lfo1">L1</option>
                            <option value="lfo2">L2</option>
                            <option value="lfo3">L3</option>
                            <option value="lfo4">L4</option>
                        </select>
                        <input type="range" class="mod-depth param-depth-cutoff" min="0" max="1" step="0.01" value="0.5" title="LFO modulation depth — how much the LFO affects cutoff">
                    </div>
                </div>
                <div class="param-box">
                    <label class="label-tiny">Volume</label>
                    <input type="range" class="param-volume" min="0" max="1.0" step="0.01" value="0.8" title="Slot volume level — 0% to 100%">
                    <div class="mod-row">
                        <select class="mod-select param-mod-volume" title="Assign an LFO to modulate volume (tremolo)">
                            <option value="">LFO</option>
                            <option value="lfo1">L1</option>
                            <option value="lfo2">L2</option>
                            <option value="lfo3">L3</option>
                            <option value="lfo4">L4</option>
                        </select>
                        <input type="range" class="mod-depth param-depth-volume" min="0" max="1" step="0.01" value="0.5" title="LFO modulation depth — how much the LFO affects volume">
                    </div>
                </div>
                <div class="param-box">
                    <label class="label-tiny">Pan</label>
                    <input type="range" class="param-pan" min="-1" max="1" step="0.01" value="0" title="Stereo panning — left (-1) to right (+1)">
                    <div class="mod-row">
                        <select class="mod-select param-mod-pan" title="Assign an LFO to modulate panning (auto-pan)">
                            <option value="">LFO</option>
                            <option value="lfo1">L1</option>
                            <option value="lfo2">L2</option>
                            <option value="lfo3">L3</option>
                            <option value="lfo4">L4</option>
                        </select>
                        <input type="range" class="mod-depth param-depth-pan" min="0" max="1" step="0.01" value="0.5" title="LFO modulation depth — how much the LFO affects panning">
                    </div>
                </div>
                <div class="param-box">
                    <label class="label-tiny">Loop</label>
                    <input type="range" class="param-loop-start" min="0" max="1.0" step="0.01" value="0" title="Loop region start position within the sample">
                    <div class="mod-row">
                        <select class="mod-select param-mod-loop-start" title="Assign an LFO to shift loop start position">
                            <option value="">LFO</option>
                            <option value="lfo1">L1</option>
                            <option value="lfo2">L2</option>
                            <option value="lfo3">L3</option>
                            <option value="lfo4">L4</option>
                        </select>
                        <input type="range" class="mod-depth param-depth-loop-start" min="0" max="1" step="0.01" value="0.5" title="LFO modulation depth — how much the LFO shifts the loop position">
                    </div>
                </div>
                <div class="param-box">
                    <label class="label-tiny">Delay</label>
                    <input type="range" class="param-delay-send" min="0" max="1.0" step="0.01" value="0" title="Delay effect send level — 0% (dry) to 100% (full delay)">
                    <div class="mod-row">
                        <select class="mod-select param-mod-delay-send" title="Assign an LFO to modulate delay send level">
                            <option value="">LFO</option>
                            <option value="lfo1">L1</option>
                            <option value="lfo2">L2</option>
                            <option value="lfo3">L3</option>
                            <option value="lfo4">L4</option>
                        </select>
                        <input type="range" class="mod-depth param-depth-delay-send" min="0" max="1" step="0.01" value="0.5" title="LFO modulation depth — how much the LFO affects delay send">
                    </div>
                </div>
                <div class="param-box">
                    <label class="label-tiny">Reverb</label>
                    <input type="range" class="param-reverb-send" min="0" max="1.0" step="0.01" value="0" title="Reverb effect send level — 0% (dry) to 100% (full reverb)">
                    <div class="mod-row">
                        <select class="mod-select param-mod-reverb-send" title="Assign an LFO to modulate reverb send level">
                            <option value="">LFO</option>
                            <option value="lfo1">L1</option>
                            <option value="lfo2">L2</option>
                            <option value="lfo3">L3</option>
                            <option value="lfo4">L4</option>
                        </select>
                        <input type="range" class="mod-depth param-depth-reverb-send" min="0" max="1" step="0.01" value="0.5" title="LFO modulation depth — how much the LFO affects reverb send">
                    </div>
                </div>
                <div class="param-box adsr-box">
                    <label class="label-tiny">ADSR</label>
                    <div class="adsr-sliders">
                        <div class="adsr-slider">
                            <input type="range" class="param-attack" min="0.001" max="2.0" step="0.001" value="0.01" title="Attack — time to reach peak volume (1ms to 2s)">
                            <span class="adsr-label">A</span>
                        </div>
                        <div class="adsr-slider">
                            <input type="range" class="param-decay" min="0.001" max="2.0" step="0.001" value="0.1" title="Decay — time to fall from peak to sustain level (1ms to 2s)">
                            <span class="adsr-label">D</span>
                        </div>
                        <div class="adsr-slider">
                            <input type="range" class="param-sustain" min="0" max="1.0" step="0.01" value="0.8" title="Sustain — volume level held during playback (0% to 100%)">
                            <span class="adsr-label">S</span>
                        </div>
                        <div class="adsr-slider">
                            <input type="range" class="param-release" min="0.01" max="3.0" step="0.01" value="0.4" title="Release — fade-out time after stopping (10ms to 3s)">
                            <span class="adsr-label">R</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.element = div;
        this.container.appendChild(div);

        this.vuCanvas = div.querySelector('.vu-meter-canvas');
        this.vuCtx = this.vuCanvas.getContext('2d');

        this.initWaveSurfer(div.querySelector('.ws-waveform'));
        this.setupListeners();
        this.setupZoom();
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
            this.isDraggingRegion = true;
            const duration = this.wavesurfer.getDuration();
            if (duration > 0) {
                const normStart = region.start / duration;
                const normEnd = region.end / duration;

                // Sync Slider
                const loopStartSlider = this.element.querySelector('.param-loop-start');
                if (loopStartSlider && !this.isDraggingSlider) {
                    loopStartSlider.value = normStart;
                }

                // If dragging slider, DO NOT update voice settings (wait for change event)
                // If NOT dragging slider (e.g. dragging region on canvas), update settings immediately
                if (!this.isDraggingSlider) {
                    this.voice.updateSettings({
                        loopStart: normStart,
                        loopEnd: normEnd
                    });
                }
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
                // If playing, restart to jump to the new region immediately
                if (this.voice.isPlaying) {
                    this.voice.trigger();
                }
            }
        });

        this.regions.on('region-update-end', (region) => {
            this.isDraggingRegion = false;
            const duration = this.wavesurfer.getDuration();
            if (duration > 0) {
                this.voice.updateSettings({
                    loopStart: region.start / duration,
                    loopEnd: region.end / duration
                });
                // If playing, restart to jump to the new region immediately
                if (this.voice.isPlaying) {
                    this.voice.trigger();
                }
                window.dispatchEvent(new CustomEvent('slot-state-changed'));
            }
        });

        this.regions.on('region-clicked', () => {
            this.voice.trigger();
        });
    }

    setupZoom() {
        const waveformContainer = this.element.querySelector('.waveform-container');

        // Mouse wheel zoom
        waveformContainer.addEventListener('wheel', (e) => {
            if (!this.wavesurfer || !this.voice.buffer) return;

            e.preventDefault();
            const delta = e.deltaY > 0 ? -20 : 20;
            this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel + delta));

            if (this.zoomLevel === 0) {
                // Reset to fit container
                this.wavesurfer.zoom(0);
            } else {
                this.wavesurfer.zoom(this.zoomLevel);
            }
        }, { passive: false });

        // Touch pinch-to-zoom
        waveformContainer.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                this.isPinching = true;
                this.lastPinchDistance = this.getPinchDistance(e.touches);
            }
        }, { passive: true });

        waveformContainer.addEventListener('touchmove', (e) => {
            if (!this.isPinching || e.touches.length !== 2) return;
            if (!this.wavesurfer || !this.voice.buffer) return;

            e.preventDefault();
            const currentDistance = this.getPinchDistance(e.touches);
            const delta = (currentDistance - this.lastPinchDistance) * 0.5;

            this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel + delta));

            if (this.zoomLevel === 0) {
                this.wavesurfer.zoom(0);
            } else {
                this.wavesurfer.zoom(this.zoomLevel);
            }

            this.lastPinchDistance = currentDistance;
        }, { passive: false });

        waveformContainer.addEventListener('touchend', (e) => {
            if (e.touches.length < 2) {
                this.isPinching = false;
            }
        }, { passive: true });

        // Auto-scroll when dragging near edges
        const edgeThreshold = 40; // pixels from edge to trigger scroll
        const scrollSpeed = 8;

        const checkEdgeScroll = (clientX) => {
            if (this.zoomLevel === 0) return; // No scroll needed if not zoomed

            const rect = waveformContainer.getBoundingClientRect();
            const relativeX = clientX - rect.left;

            if (relativeX < edgeThreshold) {
                // Near left edge - scroll left
                this.autoScrollDirection = -scrollSpeed;
            } else if (relativeX > rect.width - edgeThreshold) {
                // Near right edge - scroll right
                this.autoScrollDirection = scrollSpeed;
            } else {
                this.autoScrollDirection = 0;
            }

            if (this.autoScrollDirection !== 0 && !this.autoScrollRAF) {
                this.startAutoScroll(waveformContainer);
            } else if (this.autoScrollDirection === 0 && this.autoScrollRAF) {
                this.stopAutoScroll();
            }
        };

        waveformContainer.addEventListener('mousemove', (e) => {
            if (e.buttons === 1) { // Left mouse button held
                checkEdgeScroll(e.clientX);
            }
        });

        waveformContainer.addEventListener('mouseup', () => {
            this.stopAutoScroll();
        });

        waveformContainer.addEventListener('mouseleave', () => {
            this.stopAutoScroll();
        });

        // Touch auto-scroll
        waveformContainer.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1 && !this.isPinching) {
                checkEdgeScroll(e.touches[0].clientX);
            }
        }, { passive: true });

        waveformContainer.addEventListener('touchend', () => {
            this.stopAutoScroll();
        }, { passive: true });
    }

    startAutoScroll(container) {
        const scroll = () => {
            if (this.autoScrollDirection === 0) {
                this.autoScrollRAF = null;
                return;
            }
            container.scrollLeft += this.autoScrollDirection;
            this.autoScrollRAF = requestAnimationFrame(scroll);
        };
        this.autoScrollRAF = requestAnimationFrame(scroll);
    }

    stopAutoScroll() {
        this.autoScrollDirection = 0;
        if (this.autoScrollRAF) {
            cancelAnimationFrame(this.autoScrollRAF);
            this.autoScrollRAF = null;
        }
    }

    getPinchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
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

        // Loop Start Param
        const loopStartSlider = this.element.querySelector('.param-loop-start');
        const loopStartMod = this.element.querySelector('.param-mod-loop-start');

        loopStartSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value); // 0-1

            // Try to update visual region if it exists
            const regions = this.regions.getRegions();
            const duration = this.wavesurfer.getDuration();

            if (regions.length > 0 && duration > 0) {
                const region = regions[0];
                const regionLen = region.end - region.start; // Seconds

                // Calculate target start/end in seconds
                let newStart = val * duration;

                // Clamp so we don't push the region out of bounds
                if (newStart + regionLen > duration) {
                    newStart = duration - regionLen;
                }

                // Update region (this triggers 'region-updated' -> voice.updateSettings)
                region.setOptions({
                    start: newStart,
                    end: newStart + regionLen
                });

                // Explicitly update settings to ensure immediate audio feedback (redundancy)
                this.voice.updateSettings({
                    loopStart: newStart / duration,
                    loopEnd: (newStart + regionLen) / duration
                });
            } else {
                // Fallback: Just update voice settings
                const currentLen = this.voice.settings.loopEnd - this.voice.settings.loopStart;
                let newStart = val;

                if (newStart + currentLen > 1.0) {
                    newStart = 1.0 - currentLen;
                }

                this.voice.updateSettings({
                    loopStart: newStart,
                    loopEnd: newStart + currentLen
                });
            }
        });

        // CHANGE: Update Audio (Commit) & Retrigger
        loopStartSlider.addEventListener('change', (e) => {
            this.isDraggingSlider = false;
            const val = parseFloat(e.target.value);

            // Sync fallback
            const currentLen = this.voice.settings.loopEnd - this.voice.settings.loopStart;
            let newStart = val;
            if (newStart + currentLen > 1.0) newStart = 1.0 - currentLen;

            this.voice.updateSettings({
                loopStart: newStart,
                loopEnd: newStart + currentLen
            });

            // Retrigger to jump to new position instantly
            if (this.voice.isPlaying) {
                this.voice.trigger();
            }
        });

        loopStartMod.addEventListener('change', (e) => {
            this.voice.updateSettings({
                modAssignments: {
                    ...this.voice.settings.modAssignments,
                    loopStart: e.target.value || null
                }
            });
        });

        // Play/Pause and Mute
        const playBtn = this.element.querySelector('.btn-play');
        const muteBtn = this.element.querySelector('.btn-mute');
        const loopBtn = this.element.querySelector('.btn-loop');

        playBtn.addEventListener('click', () => {
            if (this.voice.activeSource) {
                this.voice.stop();
                playBtn.classList.remove('active');
            } else {
                this.voice.trigger();
                playBtn.classList.add('active');
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

        const reverseBtn = this.element.querySelector('.btn-reverse');
        reverseBtn.addEventListener('click', () => {
            const isReversed = !this.voice.settings.reverse;
            this.voice.updateSettings({ reverse: isReversed });
            reverseBtn.classList.toggle('active', isReversed);
            // Retrigger if playing to apply reverse immediately
            if (this.voice.isPlaying) {
                this.voice.trigger();
            }
            window.dispatchEvent(new CustomEvent('slot-state-changed'));
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
                filterType: this.element.querySelector('.param-filter-type').value,
                cutoff: parseFloat(this.element.querySelector('.param-cutoff').value),
                pan: parseFloat(this.element.querySelector('.param-pan').value),
                volume: parseFloat(this.element.querySelector('.param-volume').value),
                attack: parseFloat(this.element.querySelector('.param-attack').value),
                decay: parseFloat(this.element.querySelector('.param-decay').value),
                sustain: parseFloat(this.element.querySelector('.param-sustain').value),
                release: parseFloat(this.element.querySelector('.param-release').value),
                delaySend: parseFloat(this.element.querySelector('.param-delay-send').value),
                reverbSend: parseFloat(this.element.querySelector('.param-reverb-send').value),
                modAssignments: {
                    pitch: this.element.querySelector('.param-mod-pitch').value || null,
                    cutoff: this.element.querySelector('.param-mod-cutoff').value || null,
                    volume: this.element.querySelector('.param-mod-volume').value || null,
                    pan: this.element.querySelector('.param-mod-pan').value || null,
                    loopStart: this.element.querySelector('.param-mod-loop-start').value || null,
                    delaySend: this.element.querySelector('.param-mod-delay-send').value || null,
                    reverbSend: this.element.querySelector('.param-mod-reverb-send').value || null
                },
                modulationDepths: {
                    pitch: parseFloat(this.element.querySelector('.param-depth-pitch').value),
                    cutoff: parseFloat(this.element.querySelector('.param-depth-cutoff').value),
                    volume: parseFloat(this.element.querySelector('.param-depth-volume').value),
                    pan: parseFloat(this.element.querySelector('.param-depth-pan').value),
                    loopStart: parseFloat(this.element.querySelector('.param-depth-loop-start').value),
                    delaySend: parseFloat(this.element.querySelector('.param-depth-delay-send').value),
                    reverbSend: parseFloat(this.element.querySelector('.param-depth-reverb-send').value)
                }
            });
            window.dispatchEvent(new CustomEvent('slot-state-changed'));
        };

        this.element.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('input', updateVoiceParams);
            input.addEventListener('change', updateVoiceParams);
        });

        // LFO Update Listener
        window.addEventListener('lfo-update', () => {
            if (this.voice.settings.modAssignments.pitch ||
                this.voice.settings.modAssignments.cutoff ||
                this.voice.settings.modAssignments.volume ||
                this.voice.settings.modAssignments.pan ||
                this.voice.settings.modAssignments.loopStart ||
                this.voice.settings.modAssignments.delaySend ||
                this.voice.settings.modAssignments.reverbSend) {

                this.voice.applyRealtimeParams();

                // Visual Update for Loop Start Slider and Region
                if (this.voice.settings.modAssignments.loopStart && !this.isDraggingSlider && !this.isDraggingRegion) {
                    const lfoVal = audioEngine.getLFOValue(this.voice.settings.modAssignments.loopStart);
                    const slider = this.element.querySelector('.param-loop-start');
                    const duration = this.wavesurfer.getDuration();

                    const currentStart = this.voice.settings.loopStart;
                    const currentLen = this.voice.settings.loopEnd - this.voice.settings.loopStart;

                    // Modulate shift by +/- 50% (normalized)
                    const offset = lfoVal * 0.5;

                    // Calculate visual position with clamping (mirroring Voice.js logic)
                    let visualStart = currentStart + offset;
                    const maxStart = 1.0 - currentLen;
                    visualStart = Math.max(0, Math.min(maxStart, visualStart));

                    // Update slider
                    if (slider) {
                        slider.value = visualStart;
                    }

                    // Update region visual
                    const regions = this.regions.getRegions();
                    if (regions.length > 0 && duration > 0) {
                        const region = regions[0];
                        const newStartSec = visualStart * duration;
                        const newEndSec = (visualStart + currentLen) * duration;
                        region.setOptions({
                            start: newStartSec,
                            end: newEndSec
                        });
                    }
                }
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
        // Cancel any pending ready handler from previous load
        if (this._pendingOnReady) {
            this.wavesurfer.un('ready', this._pendingOnReady);
            this._pendingOnReady = null;
        }

        this.voice.setBuffer(buffer);
        // Wavesurfer v7 load expects a URL or Blob
        const url = URL.createObjectURL(blob);

        // Wait for wavesurfer to be ready before resetting zoom
        this._pendingOnReady = () => {
            this.zoomLevel = 0;
            this.wavesurfer.zoom(0);
            this._pendingOnReady = null;
        };
        this.wavesurfer.on('ready', this._pendingOnReady);

        this.wavesurfer.load(url);

        // Mark as having a sample (removes pulsing border)
        this.element.querySelector('.waveform-container').classList.add('has-sample');

        this.regions.clearRegions();
        this.voice.updateSettings({ loopStart: 0, loopEnd: 1.0 });
    }

    updateMenu(keys) {
        const select = this.element.querySelector('.sample-select');
        const currentValue = select.value;

        select.innerHTML = '<option value="">Select a Sample</option>';
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
        // Cancel any pending region timeout from previous setState
        if (this._pendingRegionTimeout) {
            clearTimeout(this._pendingRegionTimeout);
            this._pendingRegionTimeout = null;
        }

        // Stop any playing voice
        this.voice.stop();

        if (state.sampleKey) {
            const buffer = audioEngine.getBuffer(state.sampleKey);
            const blob = audioEngine.getBlob(state.sampleKey);
            if (buffer && blob) {
                this.loadBuffer(buffer, blob);
                if (state.region) {
                    this._pendingRegionTimeout = setTimeout(() => {
                        this._pendingRegionTimeout = null;
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
        this.element.querySelector('.param-filter-type').value = settings.filterType || 'lowpass';
        this.element.querySelector('.param-cutoff').value = settings.cutoff;
        this.element.querySelector('.param-pan').value = settings.pan || 0;
        this.element.querySelector('.param-volume').value = settings.volume || 0.8;
        this.element.querySelector('.param-loop-start').value = settings.loopStart || 0;
        this.element.querySelector('.param-attack').value = settings.attack || 0.01;
        this.element.querySelector('.param-decay').value = settings.decay || 0.1;
        this.element.querySelector('.param-sustain').value = settings.sustain || 0.8;
        this.element.querySelector('.param-release').value = settings.release || 0.4;
        this.element.querySelector('.param-delay-send').value = settings.delaySend || 0;
        this.element.querySelector('.param-reverb-send').value = settings.reverbSend || 0;

        // Restore reverse button state
        const reverseBtn = this.element.querySelector('.btn-reverse');
        reverseBtn.classList.toggle('active', settings.reverse || false);

        // Restore loop button state
        const loopBtn = this.element.querySelector('.btn-loop');
        loopBtn.classList.toggle('active', settings.loop !== false);

        if (settings.modAssignments) {
            this.element.querySelector('.param-mod-pitch').value = settings.modAssignments.pitch || '';
            this.element.querySelector('.param-mod-cutoff').value = settings.modAssignments.cutoff || '';
            this.element.querySelector('.param-mod-volume').value = settings.modAssignments.volume || '';
            this.element.querySelector('.param-mod-pan').value = settings.modAssignments.pan || '';
            this.element.querySelector('.param-mod-loop-start').value = settings.modAssignments.loopStart || '';
            this.element.querySelector('.param-mod-delay-send').value = settings.modAssignments.delaySend || '';
            this.element.querySelector('.param-mod-reverb-send').value = settings.modAssignments.reverbSend || '';
        }

        if (settings.modulationDepths) {
            this.element.querySelector('.param-depth-pitch').value = settings.modulationDepths.pitch || 0.5;
            this.element.querySelector('.param-depth-cutoff').value = settings.modulationDepths.cutoff || 0.5;
            this.element.querySelector('.param-depth-volume').value = settings.modulationDepths.volume || 0.5;
            this.element.querySelector('.param-depth-pan').value = settings.modulationDepths.pan || 0.5;
            this.element.querySelector('.param-depth-loop-start').value = settings.modulationDepths.loopStart || 0.5;
            this.element.querySelector('.param-depth-delay-send').value = settings.modulationDepths.delaySend || 0.5;
            this.element.querySelector('.param-depth-reverb-send').value = settings.modulationDepths.reverbSend || 0.5;
        }

        this.voice.updateSettings(settings);
    }
}
