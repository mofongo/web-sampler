/**
 * Poly-Sampler Rack 2026 - Voice Component
 */
import { audioEngine } from './audioEngine';

export class Voice {
    constructor(slotId) {
        this.slotId = slotId;
        this.buffer = null;
        this.settings = {
            pitch: 1.0,
            cutoff: 20000,
            res: 1,
            attack: 0.01,
            release: 0.4,
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
        const now = audioEngine.context.currentTime;

        // Base values with LFO modulation if assigned
        let pitch = this.settings.pitch;
        let cutoff = this.settings.cutoff;
        let volume = this.settings.volume;
        let pan = this.settings.pan;

        if (this.settings.modAssignments.pitch) {
            const lfoVal = audioEngine.getLFOValue(this.settings.modAssignments.pitch);
            pitch *= (1 + lfoVal * 0.5); // Modulation depth
        }
        if (this.settings.modAssignments.cutoff) {
            const lfoVal = audioEngine.getLFOValue(this.settings.modAssignments.cutoff);
            // Limit cutoff to valid range 20-20000
            cutoff = Math.max(20, Math.min(20000, cutoff * Math.pow(2, lfoVal * 4)));
        }
        if (this.settings.modAssignments.volume) {
            const lfoVal = audioEngine.getLFOValue(this.settings.modAssignments.volume);
            volume *= Math.max(0, 1 + lfoVal);
        }
        if (this.settings.modAssignments.pan) {
            const lfoVal = audioEngine.getLFOValue(this.settings.modAssignments.pan);
            // Modulate pan by +/- 1.0, clamp to valid range -1 to 1
            pan = Math.max(-1, Math.min(1, pan + lfoVal));
        }

        if (this.activeSource) {
            this.activeSource.playbackRate.setTargetAtTime(pitch, now, 0.05);

            // Live Loop Updates
            if (this.buffer) {
                const startSec = this.settings.loopStart * this.buffer.duration;
                const endSec = this.settings.loopEnd * this.buffer.duration;
                const loopDuration = endSec - startSec;

                // Modulate Loop Start (Shift Logic)
                let finalStart = startSec;
                if (this.settings.modAssignments.loopStart) {
                    const lfoVal = audioEngine.getLFOValue(this.settings.modAssignments.loopStart);
                    // Modulate shift by +/- 50% of file duration
                    const modAmount = lfoVal * 0.5 * this.buffer.duration;
                    finalStart = startSec + modAmount;
                }

                // Clamp start so the full loop fits
                // Max start = buffer.duration - loopDuration
                finalStart = Math.max(0, Math.min(this.buffer.duration - loopDuration, finalStart));

                // Calculate End based on fixed duration
                const finalEnd = finalStart + loopDuration;

                this.activeSource.loop = this.settings.loop;
                this.activeSource.loopStart = finalStart;
                this.activeSource.loopEnd = finalEnd;
            }
        }
        if (this.filterNode) {
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
            delaySend = Math.max(0, Math.min(1, delaySend + lfoVal * 0.5));
        }
        if (this.settings.modAssignments.reverbSend) {
            const lfoVal = audioEngine.getLFOValue(this.settings.modAssignments.reverbSend);
            reverbSend = Math.max(0, Math.min(1, reverbSend + lfoVal * 0.5));
        }

        if (this.delaySendNode) {
            this.delaySendNode.gain.setTargetAtTime(delaySend, now, 0.05);
        }
        if (this.reverbSendNode) {
            this.reverbSendNode.gain.setTargetAtTime(reverbSend, now, 0.05);
        }
    }

    trigger() {
        if (!this.buffer || !audioEngine.initialized) return;

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
        const startSec = this.settings.loopStart * this.buffer.duration;
        const endSec = this.settings.loopEnd * this.buffer.duration;
        const duration = Math.max(0.01, endSec - startSec);

        // Nodes
        this.activeSource = context.createBufferSource();
        this.activeSource.buffer = this.buffer;
        this.activeSource.playbackRate.value = this.settings.pitch;

        this.gainNode = context.createGain();
        this.filterNode = context.createBiquadFilter();
        this.filterNode.type = 'lowpass';
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

        // Initial volume
        const targetVol = this.isMuted ? 0 : this.settings.volume;
        this.gainNode.gain.setValueAtTime(0, now);

        // ADSR - Attack
        this.gainNode.gain.linearRampToValueAtTime(targetVol, now + this.settings.attack);

        // Play with loop points
        if (this.settings.loop) {
            this.activeSource.loop = true;
            this.activeSource.loopStart = startSec;
            this.activeSource.loopEnd = endSec;
            this.activeSource.start(now, startSec);
        } else {
            this.activeSource.start(now, startSec, duration);

            // Handle Release
            const scaledDuration = duration / this.settings.pitch;
            const stopTime = now + scaledDuration;

            this.gainNode.gain.setValueAtTime(targetVol, stopTime);
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
            this.gainNode.gain.cancelScheduledValues(now);
            this.gainNode.gain.setTargetAtTime(0, now, 0.05);
            this.activeSource.stop(now + 0.1);

            if (this.cleanupTimeout) clearTimeout(this.cleanupTimeout);
            // FIX: Assign the timeout ID so it can be cleared if re-triggered
            this.cleanupTimeout = setTimeout(() => this.cleanup(), 150);
        }
    }

    get isPlaying() {
        return !!this.activeSource;
    }
}
