class LFO {
    constructor(id) {
        this.id = id;
        this.frequency = 1.0; // Hz
        this.type = 'sine'; // 'sine', 'random-square', 'smooth-random'
        this.phase = 0;
        this.value = 0;

        // For random shapes
        this.lastRandomValue = Math.random() * 2 - 1;
        this.nextRandomValue = Math.random() * 2 - 1;
        this.lastUpdateTime = 0;
    }

    update(currentTime, deltaTime) {
        this.phase += 2 * Math.PI * this.frequency * deltaTime;

        switch (this.type) {
            case 'sine':
                this.value = Math.sin(this.phase);
                break;
            case 'random-square':
                // Change value every cycle
                if (Math.floor(this.phase / Math.PI) !== Math.floor((this.phase - 2 * Math.PI * this.frequency * deltaTime) / Math.PI)) {
                    this.value = Math.random() > 0.5 ? 1 : -1;
                }
                break;
            case 'smooth-random':
                const cycle = this.phase / (2 * Math.PI);
                const progress = cycle % 1.0;
                const cycleIndex = Math.floor(cycle);

                if (cycleIndex !== this.lastCycleIndex) {
                    this.lastRandomValue = this.nextRandomValue;
                    this.nextRandomValue = Math.random() * 2 - 1;
                    this.lastCycleIndex = cycleIndex;
                }

                // Cosine interpolation for smoothness
                const f = (1 - Math.cos(progress * Math.PI)) * 0.5;
                this.value = this.lastRandomValue * (1 - f) + this.nextRandomValue * f;
                break;
        }
    }
}

class AudioEngine {
    constructor() {
        this.context = null;
        this.masterGain = null;
        this.limiter = null;
        this.globalLibrary = new Map(); // name -> AudioBuffer
        this.initialized = false;

        this.lfos = {
            lfo1: new LFO(1),
            lfo2: new LFO(2),
            lfo3: new LFO(3),
            lfo4: new LFO(4)
        };
        this.lastTickTime = 0;
    }

    async init() {
        if (this.initialized) return;

        this.context = new (window.AudioContext || window.webkitAudioContext)();

        // Safety Limiter
        this.limiter = this.context.createDynamicsCompressor();
        this.limiter.threshold.setValueAtTime(-1, this.context.currentTime);
        this.limiter.knee.setValueAtTime(0, this.context.currentTime);
        this.limiter.ratio.setValueAtTime(20, this.context.currentTime);
        this.limiter.attack.setValueAtTime(0.003, this.context.currentTime);
        this.limiter.release.setValueAtTime(0.1, this.context.currentTime);

        // Master Gain
        this.masterGain = this.context.createGain();
        this.masterGain.gain.setValueAtTime(0.8, this.context.currentTime);

        // Routing: Master Gain -> Limiter -> Destination
        this.masterGain.connect(this.limiter);
        this.limiter.connect(this.context.destination);

        this.initialized = true;
        this.startUpdateLoop();
        console.log('Audio Engine Initialized');
    }

    startUpdateLoop() {
        const tick = (time) => {
            const deltaTime = (time - this.lastTickTime) / 1000;
            this.lastTickTime = time;

            if (deltaTime > 0 && deltaTime < 0.1) {
                Object.values(this.lfos).forEach(lfo => lfo.update(time, deltaTime));
                // Signal voices to update their modulated parameters
                window.dispatchEvent(new CustomEvent('lfo-update'));
            }

            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    getLFOValue(id) {
        return this.lfos[id]?.value || 0;
    }

    setLFOParams(id, params) {
        const lfo = this.lfos[id];
        if (lfo) {
            if (params.frequency !== undefined) lfo.frequency = params.frequency;
            if (params.type !== undefined) lfo.type = params.type;
        }
    }

    async decodeFile(file) {
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
        this.globalLibrary.set(file.name, { buffer: audioBuffer, blob: file });
        return { name: file.name, buffer: audioBuffer, blob: file };
    }

    setMasterVolume(value) {
        if (!this.masterGain) return;
        this.masterGain.gain.setTargetAtTime(value, this.context.currentTime, 0.05);
    }

    getBuffer(name) {
        const item = this.globalLibrary.get(name);
        return item ? item.buffer : null;
    }

    getBlob(name) {
        const item = this.globalLibrary.get(name);
        return item ? item.blob : null;
    }

    async loadFromUrl(url) {
        const response = await fetch(url);
        const blob = await response.blob();
        // Extract filename from URL (simple version)
        const name = url.split('/').pop();
        // File object is compatible with existing decode logic if we mock it or just use similar logic
        // But here we already have the blob, so let's just use arrayBuffer from blob
        const arrayBuffer = await blob.arrayBuffer();
        const audioBuffer = await this.context.decodeAudioData(arrayBuffer);

        // We need a File-like object or at least store the blob with the name
        // The existing set expects (name, {buffer, blob})
        this.globalLibrary.set(name, { buffer: audioBuffer, blob: blob });

        return { name, buffer: audioBuffer, blob };
    }

    getLibraryKeys() {
        return Array.from(this.globalLibrary.keys());
    }
}

export const audioEngine = new AudioEngine();
