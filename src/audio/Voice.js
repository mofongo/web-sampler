/**
 * Poly-Sampler Rack 2026 - Voice Component
 */
import { audioEngine } from './audioEngine';

export class Voice {
    constructor(slotId) {
        this.slotId = slotId;
        this.buffer = null;
        this.reversedBuffer = null;
        this.settings = {
            pitch: 1.0,
            cutoff: 20000,
            res: 1,
            filterType: 'lowpass',
            attack: 0.01,
            decay: 0.1,
            sustain: 0.8,
            release: 0.4,
            reverse: false,
            pan: 0,
            volume: 0.8,
            delaySend: 0,
            reverbSend: 0,
            loopStart: 0,
            loopEnd: 1.0,
            loop: true,
            modAssignments: {
                pitch: null,
                cutoff: null,
                volume: null,
                pan: null,
                loopStart: null,
                delaySend: null,
                reverbSend: null
            },
            modulationDepths: {
                pitch: 0.5,
                cutoff: 0.5,
                volume: 0.5,
                pan: 0.5,
                loopStart: 0.5,
                delaySend: 0.5,
                reverbSend: 0.5
            }
        };

        this.activeSource = null;
        this.gainNode = null;
        this.filterNode = null;
        this.pannerNode = null;
        this.analyserNode = null;
        this.delaySendNode = null;
        this.reverbSendNode = null;
        this.isMuted = false;
    }

    setBuffer(buffer) {
        this.buffer = buffer;
        this.reversedBuffer = null;
    }

    createReversedBuffer() {
        if (!this.buffer || !audioEngine.context) return null;

        const { context } = audioEngine;
        const original = this.buffer;
        const reversed = context.createBuffer(
            original.numberOfChannels,
            original.length,
            original.sampleRate
        );

        for (let channel = 0; channel < original.numberOfChannels; channel++) {
            const originalData = original.getChannelData(channel);
            const reversedData = reversed.getChannelData(channel);
            for (let i = 0; i < original.length; i++) {
                reversedData[i] = originalData[original.length - 1 - i];
            }
        }

        return reversed;
    }

    getPlaybackBuffer() {
        if (!this.settings.reverse) return this.buffer;
        if (!this.reversedBuffer) {
            this.reversedBuffer = this.createReversedBuffer();
        }
        return this.reversedBuffer;
    }

    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.applyRealtimeParams();
    }

    setMute(muted) {
        this.isMuted = muted;
        if (this.gainNode) {
            this.gainNode.gain.setTargetAtTime(this.isMuted ? 0 : this.settings.volume, audioEngine.context.currentTime, 0.05);
        }
    }

    applyRealtimeParams() {
        if (!audioEngine.initialized) return;
        const now = audioEngine.context.currentTime;

        // Base values with LFO modulation if assigned
        let pitch = this.settings.pitch;
        let cutoff = this.settings.cutoff;
        let volume = this.settings.volume;
        let pan = this.settings.pan;

        if (this.settings.modAssignments.pitch) {
            const lfoVal = audioEngine.getLFOValue(this.settings.modAssignments.pitch);
            const depth = this.settings.modulationDepths.pitch;
            pitch *= (1 + lfoVal * depth);
        }
        if (this.settings.modAssignments.cutoff) {
            const lfoVal = audioEngine.getLFOValue(this.settings.modAssignments.cutoff);
            const depth = this.settings.modulationDepths.cutoff;
            // Limit cutoff to valid range 20-20000
            cutoff = Math.max(20, Math.min(20000, cutoff * Math.pow(2, lfoVal * depth * 8)));
        }
        if (this.settings.modAssignments.volume) {
            const lfoVal = audioEngine.getLFOValue(this.settings.modAssignments.volume);
            const depth = this.settings.modulationDepths.volume;
            volume *= Math.max(0, 1 + lfoVal * depth);
        }
        if (this.settings.modAssignments.pan) {
            const lfoVal = audioEngine.getLFOValue(this.settings.modAssignments.pan);
            const depth = this.settings.modulationDepths.pan;
            pan = Math.max(-1, Math.min(1, pan + lfoVal * depth));
        }

        if (this.activeSource) {
            this.activeSource.playbackRate.setTargetAtTime(pitch, now, 0.05);

            // Live Loop Updates
            const playbackBuffer = this.getPlaybackBuffer();
            if (playbackBuffer) {
                const startSec = this.settings.loopStart * playbackBuffer.duration;
                const endSec = this.settings.loopEnd * playbackBuffer.duration;
                const loopDuration = endSec - startSec;

                // Modulate Loop Start (Shift Logic)
                let finalStart = startSec;
                if (this.settings.modAssignments.loopStart) {
                    const lfoVal = audioEngine.getLFOValue(this.settings.modAssignments.loopStart);
                    const depth = this.settings.modulationDepths.loopStart;
                    const modAmount = lfoVal * depth * playbackBuffer.duration;
                    finalStart = startSec + modAmount;
                }

                // Clamp start so the full loop fits
                // Max start = buffer.duration - loopDuration
                finalStart = Math.max(0, Math.min(playbackBuffer.duration - loopDuration, finalStart));

                // Calculate End based on fixed duration
                const finalEnd = finalStart + loopDuration;

                this.activeSource.loop = this.settings.loop;
                this.activeSource.loopStart = finalStart;
                this.activeSource.loopEnd = finalEnd;
            }
        }
        if (this.filterNode) {
            this.filterNode.type = this.settings.filterType;
            this.filterNode.frequency.setTargetAtTime(cutoff, now, 0.05);
            this.filterNode.Q.setTargetAtTime(this.settings.res, now, 0.05);
        }
        if (this.pannerNode) {
            this.pannerNode.pan.setTargetAtTime(pan, now, 0.05);
        }
        if (this.gainNode && !this.isMuted) {
            this.gainNode.gain.setTargetAtTime(volume, now, 0.05);
        }
        // Modulate sends
        let delaySend = this.settings.delaySend;
        let reverbSend = this.settings.reverbSend;

        if (this.settings.modAssignments.delaySend) {
            const lfoVal = audioEngine.getLFOValue(this.settings.modAssignments.delaySend);
            const depth = this.settings.modulationDepths.delaySend;
            delaySend = Math.max(0, Math.min(1, delaySend + lfoVal * depth));
        }
        if (this.settings.modAssignments.reverbSend) {
            const lfoVal = audioEngine.getLFOValue(this.settings.modAssignments.reverbSend);
            const depth = this.settings.modulationDepths.reverbSend;
            reverbSend = Math.max(0, Math.min(1, reverbSend + lfoVal * depth));
        }

        if (this.delaySendNode) {
            this.delaySendNode.gain.setTargetAtTime(delaySend, now, 0.05);
        }
        if (this.reverbSendNode) {
            this.reverbSendNode.gain.setTargetAtTime(reverbSend, now, 0.05);
        }
    }

    trigger() {
        const playbackBuffer = this.getPlaybackBuffer();
        if (!playbackBuffer || !audioEngine.initialized) return;

        // Voice stealing / Cleanup previous
        if (this.activeSource) {
            this.stop();
            // Critical fix: stop() schedules a cleanup(), but since we are restarting immediately,
            // we must cancel that cleanup so it doesn't kill the NEW source we are about to create.
            if (this.cleanupTimeout) {
                clearTimeout(this.cleanupTimeout);
                this.cleanupTimeout = null;
            }
        }

        const { context, masterGain } = audioEngine;
        const now = context.currentTime;

        // Calculate loop points in seconds
        const startSec = this.settings.loopStart * playbackBuffer.duration;
        const endSec = this.settings.loopEnd * playbackBuffer.duration;
        const duration = Math.max(0.01, endSec - startSec);

        // Nodes
        this.activeSource = context.createBufferSource();
        this.activeSource.buffer = playbackBuffer;
        this.activeSource.playbackRate.value = this.settings.pitch;

        this.gainNode = context.createGain();
        this.filterNode = context.createBiquadFilter();
        this.filterNode.type = this.settings.filterType;
        this.filterNode.frequency.value = this.settings.cutoff;
        this.filterNode.Q.value = this.settings.res;

        this.pannerNode = context.createStereoPanner();
        this.pannerNode.pan.value = this.settings.pan;

        this.analyserNode = context.createAnalyser();
        this.analyserNode.fftSize = 32;

        // Delay Send
        this.delaySendNode = context.createGain();
        this.delaySendNode.gain.value = this.settings.delaySend;

        // Reverb Send
        this.reverbSendNode = context.createGain();
        this.reverbSendNode.gain.value = this.settings.reverbSend;

        // Routing
        this.activeSource.connect(this.filterNode);
        this.filterNode.connect(this.pannerNode);
        this.pannerNode.connect(this.analyserNode);
        this.analyserNode.connect(this.gainNode);
        this.gainNode.connect(masterGain);

        // Effects Send routing (post-panner, pre-gain for parallel processing)
        if (audioEngine.delayInput) {
            this.pannerNode.connect(this.delaySendNode);
            this.delaySendNode.connect(audioEngine.delayInput);
        }
        if (audioEngine.reverbInput) {
            this.pannerNode.connect(this.reverbSendNode);
            this.reverbSendNode.connect(audioEngine.reverbInput);
        }

        // ADSR envelope
        const targetVol = this.isMuted ? 0 : this.settings.volume;
        const attackTime = this.settings.attack;
        const decayTime = this.settings.decay;
        const sustainLevel = this.settings.sustain * targetVol;

        this.gainNode.gain.setValueAtTime(0, now);
        // Attack: 0 -> peak
        this.gainNode.gain.linearRampToValueAtTime(targetVol, now + attackTime);
        // Decay: peak -> sustain level
        this.gainNode.gain.linearRampToValueAtTime(sustainLevel, now + attackTime + decayTime);

        // Play with loop points
        if (this.settings.loop) {
            this.activeSource.loop = true;
            this.activeSource.loopStart = startSec;
            this.activeSource.loopEnd = endSec;
            this.activeSource.start(now, startSec);
            // For looping: sustain holds indefinitely until stop() is called
        } else {
            this.activeSource.start(now, startSec, duration);

            // Handle Release for one-shot samples
            const scaledDuration = duration / this.settings.pitch;
            const stopTime = now + scaledDuration;

            // Release starts from sustain level
            this.gainNode.gain.setValueAtTime(sustainLevel, stopTime);
            this.gainNode.gain.exponentialRampToValueAtTime(0.001, stopTime + this.settings.release);

            this.activeSource.stop(stopTime + this.settings.release);

            // Explicitly nullify after it finishes
            const cleanupTime = (scaledDuration + this.settings.release) * 1000;
            this.cleanupTimeout = setTimeout(() => {
                this.cleanup();
            }, cleanupTime + 200);
        }
    }

    cleanup() {
        if (this.activeSource) {
            this.activeSource.disconnect();
            this.filterNode.disconnect();
            this.pannerNode.disconnect();
            this.analyserNode.disconnect();
            this.gainNode.disconnect();
            if (this.delaySendNode) this.delaySendNode.disconnect();
            if (this.reverbSendNode) this.reverbSendNode.disconnect();

            this.activeSource = null;
            this.filterNode = null;
            this.pannerNode = null;
            this.analyserNode = null;
            this.gainNode = null;
            this.delaySendNode = null;
            this.reverbSendNode = null;
        }
    }

    stop() {
        if (this.activeSource) {
            const now = audioEngine.context.currentTime;
            const releaseTime = Math.min(this.settings.release, 0.5); // Cap release for responsive stopping

            this.gainNode.gain.cancelScheduledValues(now);
            // Get current gain value and fade from there
            const currentGain = this.gainNode.gain.value;
            this.gainNode.gain.setValueAtTime(currentGain, now);
            this.gainNode.gain.exponentialRampToValueAtTime(0.001, now + releaseTime);

            this.activeSource.stop(now + releaseTime);

            if (this.cleanupTimeout) clearTimeout(this.cleanupTimeout);
            this.cleanupTimeout = setTimeout(() => this.cleanup(), (releaseTime * 1000) + 100);
        }
    }

    get isPlaying() {
        return !!this.activeSource;
    }
}
