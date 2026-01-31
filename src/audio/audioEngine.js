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
        this.nextRandomValue = Math.random() * 2 - 1;
        this.lastUpdateTime = 0;
        this.lastCycleSNH = -1;
    }

    update(currentTime, deltaTime) {
        this.phase += 2 * Math.PI * this.frequency * deltaTime;

        switch (this.type) {
            case 'sine':
                this.value = Math.sin(this.phase);
                break;
            case 'random-square':
                // Sample & Hold: Change value every cycle (2*PI)
                // Use a larger step check to ensure we catch the cycle wrap
                // logic: maintain a 'lastCycle' index based on phase
                const currentCycle = Math.floor(this.phase / (2 * Math.PI));
                if (currentCycle !== this.lastCycleSNH) {
                    this.value = Math.random() * 2 - 1; // Full range -1 to 1
                    this.lastCycleSNH = currentCycle;
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

        // Effects
        this.delayInput = null;
        this.reverbInput = null;
        this.delayNode = null;
        this.delayFeedback = null;
        this.delayWet = null;
        this.reverbNode = null;
        this.reverbWet = null;

        this.effectsParams = {
            delayTime: 0.3,
            delayFeedback: 0.4,
            delayMix: 0.3,
            reverbDecay: 2,
            reverbMix: 0.3
        };

        this.effectsModAssignments = {
            delayTime: null,
            delayFeedback: null,
            reverbDecay: null,
            reverbMix: null
        };

        // Recording (WAV)
        this.isRecording = false;
        this.recordingBuffers = [];
        this.recordingLength = 0;
        this.recorderNode = null;
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

        // Delay Input (voices connect here for delay send)
        this.delayInput = this.context.createGain();
        this.delayInput.gain.setValueAtTime(1, this.context.currentTime);

        // Delay Effect
        this.delayNode = this.context.createDelay(2.0);
        this.delayNode.delayTime.setValueAtTime(this.effectsParams.delayTime, this.context.currentTime);

        this.delayFeedback = this.context.createGain();
        this.delayFeedback.gain.setValueAtTime(this.effectsParams.delayFeedback, this.context.currentTime);

        this.delayWet = this.context.createGain();
        this.delayWet.gain.setValueAtTime(this.effectsParams.delayMix, this.context.currentTime);

        // Delay routing: delayInput -> delay -> delayWet -> masterGain
        //                              delay -> feedback -> delay (feedback loop)
        this.delayInput.connect(this.delayNode);
        this.delayNode.connect(this.delayWet);
        this.delayNode.connect(this.delayFeedback);
        this.delayFeedback.connect(this.delayNode);
        this.delayWet.connect(this.masterGain);

        // Reverb Input (voices connect here for reverb send)
        this.reverbInput = this.context.createGain();
        this.reverbInput.gain.setValueAtTime(1, this.context.currentTime);

        // Reverb Effect (using ConvolverNode with generated impulse response)
        this.reverbNode = this.context.createConvolver();
        this.reverbNode.buffer = this.createReverbImpulse(2, 2, false);

        this.reverbWet = this.context.createGain();
        this.reverbWet.gain.setValueAtTime(this.effectsParams.reverbMix, this.context.currentTime);

        // Reverb routing: reverbInput -> reverb -> reverbWet -> masterGain
        this.reverbInput.connect(this.reverbNode);
        this.reverbNode.connect(this.reverbWet);
        this.reverbWet.connect(this.masterGain);

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
                // Apply modulated effects
                this.applyModulatedEffects();
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

    // Generate a simple reverb impulse response
    createReverbImpulse(duration, decay, reverse) {
        const sampleRate = this.context.sampleRate;
        const length = sampleRate * duration;
        const impulse = this.context.createBuffer(2, length, sampleRate);
        const leftChannel = impulse.getChannelData(0);
        const rightChannel = impulse.getChannelData(1);

        for (let i = 0; i < length; i++) {
            const n = reverse ? length - i : i;
            const env = Math.pow(1 - n / length, decay);
            leftChannel[i] = (Math.random() * 2 - 1) * env;
            rightChannel[i] = (Math.random() * 2 - 1) * env;
        }

        return impulse;
    }

    setDelayTime(value) {
        if (!this.delayNode) return;
        this.effectsParams.delayTime = value;
        this.delayNode.delayTime.setTargetAtTime(value, this.context.currentTime, 0.05);
    }

    setDelayFeedback(value) {
        if (!this.delayFeedback) return;
        this.effectsParams.delayFeedback = value;
        this.delayFeedback.gain.setTargetAtTime(value, this.context.currentTime, 0.05);
    }

    setDelayMix(value) {
        if (!this.delayWet) return;
        this.effectsParams.delayMix = value;
        this.delayWet.gain.setTargetAtTime(value, this.context.currentTime, 0.05);
    }

    setReverbMix(value) {
        if (!this.reverbWet) return;
        this.effectsParams.reverbMix = value;
        this.reverbWet.gain.setTargetAtTime(value, this.context.currentTime, 0.05);
    }

    setReverbDecay(decay) {
        if (!this.reverbNode) return;
        this.effectsParams.reverbDecay = decay;
        // Recreate impulse with new decay
        this.reverbNode.buffer = this.createReverbImpulse(2, decay, false);
    }

    getEffectsParams() {
        return { ...this.effectsParams };
    }

    getEffectsModAssignments() {
        return { ...this.effectsModAssignments };
    }

    setEffectsModAssignment(param, lfoId) {
        if (param in this.effectsModAssignments) {
            this.effectsModAssignments[param] = lfoId || null;
        }
    }

    applyModulatedEffects() {
        if (!this.initialized) return;

        const now = this.context.currentTime;

        // Modulate delay time
        let delayTime = this.effectsParams.delayTime;
        if (this.effectsModAssignments.delayTime) {
            const lfoVal = this.getLFOValue(this.effectsModAssignments.delayTime);
            delayTime = Math.max(0.05, Math.min(1.0, delayTime + lfoVal * 0.3));
        }
        if (this.delayNode) {
            this.delayNode.delayTime.setTargetAtTime(delayTime, now, 0.05);
        }

        // Modulate delay feedback
        let delayFeedback = this.effectsParams.delayFeedback;
        if (this.effectsModAssignments.delayFeedback) {
            const lfoVal = this.getLFOValue(this.effectsModAssignments.delayFeedback);
            delayFeedback = Math.max(0, Math.min(0.9, delayFeedback + lfoVal * 0.3));
        }
        if (this.delayFeedback) {
            this.delayFeedback.gain.setTargetAtTime(delayFeedback, now, 0.05);
        }

        // Modulate reverb mix
        let reverbMix = this.effectsParams.reverbMix;
        if (this.effectsModAssignments.reverbMix) {
            const lfoVal = this.getLFOValue(this.effectsModAssignments.reverbMix);
            reverbMix = Math.max(0, Math.min(1, reverbMix + lfoVal * 0.5));
        }
        if (this.reverbWet) {
            this.reverbWet.gain.setTargetAtTime(reverbMix, now, 0.05);
        }
    }

    // Recording methods (WAV output)
    startRecording() {
        if (!this.initialized || this.isRecording) return false;

        this.recordingBuffers = [[], []]; // Stereo: left and right channels
        this.recordingLength = 0;

        // Create a ScriptProcessorNode to capture audio
        // Note: ScriptProcessorNode is deprecated but widely supported
        // AudioWorklet would be the modern alternative but requires more setup
        const bufferSize = 4096;
        this.recorderNode = this.context.createScriptProcessor(bufferSize, 2, 2);

        this.recorderNode.onaudioprocess = (e) => {
            if (!this.isRecording) return;

            const left = e.inputBuffer.getChannelData(0);
            const right = e.inputBuffer.getChannelData(1);

            // Copy the data (getChannelData returns a reference that gets reused)
            this.recordingBuffers[0].push(new Float32Array(left));
            this.recordingBuffers[1].push(new Float32Array(right));
            this.recordingLength += left.length;
        };

        // Connect: limiter -> recorder -> destination (recorder taps the signal)
        this.limiter.connect(this.recorderNode);
        this.recorderNode.connect(this.context.destination);

        this.isRecording = true;
        window.dispatchEvent(new CustomEvent('recording-started'));
        return true;
    }

    stopRecording() {
        if (!this.isRecording) return;

        this.isRecording = false;

        // Disconnect recorder node
        if (this.recorderNode) {
            this.limiter.disconnect(this.recorderNode);
            this.recorderNode.disconnect();
            this.recorderNode = null;
        }

        window.dispatchEvent(new CustomEvent('recording-stopped'));
    }

    getRecordingBlob() {
        if (this.recordingLength === 0) return null;

        // Merge all buffers into single arrays
        const left = this.mergeBuffers(this.recordingBuffers[0], this.recordingLength);
        const right = this.mergeBuffers(this.recordingBuffers[1], this.recordingLength);

        // Interleave channels
        const interleaved = this.interleave(left, right);

        // Create WAV file
        const wavBuffer = this.encodeWAV(interleaved, this.context.sampleRate);

        return new Blob([wavBuffer], { type: 'audio/wav' });
    }

    mergeBuffers(buffers, length) {
        const result = new Float32Array(length);
        let offset = 0;
        for (const buffer of buffers) {
            result.set(buffer, offset);
            offset += buffer.length;
        }
        return result;
    }

    interleave(left, right) {
        const length = left.length + right.length;
        const result = new Float32Array(length);
        let index = 0;
        let inputIndex = 0;

        while (inputIndex < left.length) {
            result[index++] = left[inputIndex];
            result[index++] = right[inputIndex];
            inputIndex++;
        }

        return result;
    }

    encodeWAV(samples, sampleRate) {
        const numChannels = 2;
        const bitsPerSample = 16;
        const bytesPerSample = bitsPerSample / 8;
        const blockAlign = numChannels * bytesPerSample;
        const byteRate = sampleRate * blockAlign;
        const dataSize = samples.length * bytesPerSample;
        const bufferSize = 44 + dataSize;

        const buffer = new ArrayBuffer(bufferSize);
        const view = new DataView(buffer);

        // WAV header
        this.writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        this.writeString(view, 8, 'WAVE');
        this.writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true); // fmt chunk size
        view.setUint16(20, 1, true); // PCM format
        view.setUint16(22, numChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, byteRate, true);
        view.setUint16(32, blockAlign, true);
        view.setUint16(34, bitsPerSample, true);
        this.writeString(view, 36, 'data');
        view.setUint32(40, dataSize, true);

        // Write audio data
        let offset = 44;
        for (let i = 0; i < samples.length; i++) {
            const sample = Math.max(-1, Math.min(1, samples[i]));
            const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
            view.setInt16(offset, intSample, true);
            offset += 2;
        }

        return buffer;
    }

    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    downloadRecording(filename = 'recording') {
        const blob = this.getRecordingBlob();
        if (!blob) return;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.wav`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

export const audioEngine = new AudioEngine();
