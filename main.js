import { audioEngine } from './src/audio/audioEngine';
import { PlayerUI } from './src/ui/PlayerUI';
import { LFORack } from './src/ui/LFORack';
import { EffectsRack } from './src/ui/EffectsRack';
import { AdditiveSynthRack } from './src/ui/AdditiveSynthRack';
import { FreesoundBrowser } from './src/ui/FreesoundBrowser';
import { PresetDropdown } from './src/ui/PresetDropdown';
import { presetStorage } from './src/storage/presetStorage';

const rack = document.querySelector('#sampler-rack');
const addSlotBtn = document.querySelector('#add-slot-btn');
const masterVol = document.querySelector('#master-vol');
const freesoundBtn = document.querySelector('#freesound-btn');
const recordBtn = document.querySelector('#record-btn');

let slots = [];
let lfoRack = null;
let effectsRack = null;
let additiveSynthRack = null;
let freesoundBrowser = null;
let presetDropdown = null;
const MAX_SLOTS = 16;

async function initApp() {
    // Initial slots
    for (let i = 0; i < 4; i++) {
        addSlot();
    }

    // Initialize LFO Rack
    lfoRack = new LFORack('lfo-rack');

    // Initialize Effects Rack
    effectsRack = new EffectsRack('effects-rack');

    // Initialize Additive Synth Rack
    additiveSynthRack = new AdditiveSynthRack('additive-synth-rack');

    // Initialize Freesound Browser
    freesoundBrowser = new FreesoundBrowser();
    freesoundBtn.addEventListener('click', () => freesoundBrowser.open());

    // Initialize Preset System
    await presetStorage.init();
    presetDropdown = new PresetDropdown();
    presetDropdown.onSave = handleSavePreset;
    presetDropdown.onLoad = handleLoadPreset;
    presetDropdown.onDelete = handleDeletePreset;

    const masterControls = document.querySelector('.master-controls');
    masterControls.insertBefore(presetDropdown.element, masterControls.firstChild);

    // Recording controls
    recordBtn.addEventListener('click', () => {
        if (audioEngine.isRecording) {
            audioEngine.stopRecording();
        } else {
            audioEngine.startRecording();
        }
    });

    window.addEventListener('recording-started', () => {
        recordBtn.classList.add('recording');
        recordBtn.textContent = 'STOP';
    });

    window.addEventListener('recording-stopped', () => {
        recordBtn.classList.remove('recording');
        recordBtn.textContent = 'REC';

        // Auto-download the recording
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
        audioEngine.downloadRecording(`poly-sampler-${timestamp}`);
    });

    // Initialize Audio on first interaction
    document.addEventListener('mousedown', async () => {
        if (!audioEngine.initialized) {
            await audioEngine.init();

            // Preload sample library
            const defaultSamples = [
                '/audio/synth-pad-ambient-c.wav',
                '/audio/synth-pad-ambient-c-high.wav',
                '/audio/synth-pad-ambient-c-melod.wav'
            ];

            try {
                await Promise.all(defaultSamples.map(url => audioEngine.loadFromUrl(url)));
                const keys = audioEngine.getLibraryKeys();
                slots.forEach(slot => slot.updateMenu(keys));
            } catch (err) {
                console.error('Failed to load default samples:', err);
            }

            setupVisualizer();
        }
    }, { once: true });

    // Listeners
    addSlotBtn.addEventListener('click', () => {
        if (slots.length < MAX_SLOTS) {
            addSlot();
        } else {
            alert('Maximum 16 slots reached.');
        }
    });

    masterVol.addEventListener('input', (e) => {
        audioEngine.setMasterVolume(parseFloat(e.target.value));
    });

    window.addEventListener('new-sample-loaded', () => {
        const keys = audioEngine.getLibraryKeys();
        slots.forEach(slot => slot.updateMenu(keys));
    });

}

function addSlot() {
    const slotId = slots.length + 1;
    const slot = new PlayerUI(slotId, rack);
    slots.push(slot);

    // Update menu with existing samples
    const keys = audioEngine.getLibraryKeys();
    slot.updateMenu(keys);
    return slot;
}

function setupVisualizer() {
    const canvas = document.querySelector('#master-visualizer');
    const ctx = canvas.getContext('2d');
    const analyser = audioEngine.context.createAnalyser();
    audioEngine.limiter.connect(analyser);

    analyser.fftSize = 64;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
        requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const barHeight = (dataArray[i] / 255) * canvas.height;
            ctx.fillStyle = `rgb(0, ${dataArray[i] + 100}, 255)`;
            ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 1;
        }
    }
    draw();
}

function exportProject() {
    const project = {
        projectTitle: "My Sampler Project",
        masterVolume: parseFloat(masterVol.value),
        lfos: Object.keys(audioEngine.lfos).map(id => ({
            id,
            frequency: audioEngine.lfos[id].frequency,
            type: audioEngine.lfos[id].type
        })),
        slots: slots.map(s => s.getState())
    };

    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'poly-sampler-project.json';
    a.click();
}

function importProject() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            const project = JSON.parse(event.target.result);
            applyProjectState(project);
        };
        reader.readAsText(file);
    };
    input.click();
}

function applyProjectState(project) {
    if (project.masterVolume !== undefined) {
        masterVol.value = project.masterVolume;
        audioEngine.setMasterVolume(project.masterVolume);
    }

    // Apply LFO settings
    if (project.lfos) {
        project.lfos.forEach(lfo => {
            audioEngine.setLFOParams(lfo.id, {
                frequency: lfo.frequency,
                type: lfo.type
            });
        });
        // Refresh LFO UI
        if (lfoRack) lfoRack.render();
    }

    // Apply effects settings
    if (project.effects && effectsRack) {
        effectsRack.setState(project.effects);
    }

    // Apply additive synth settings
    if (project.additiveSynth && additiveSynthRack) {
        additiveSynthRack.setState(project.additiveSynth);
    }

    // Match slots
    project.slots.forEach((slotData, index) => {
        if (slots[index]) {
            slots[index].setState(slotData);
        } else if (index < MAX_SLOTS) {
            const slot = addSlot();
            slot.setState(slotData);
        }
    });
}

function getProjectState() {
    return {
        masterVolume: parseFloat(masterVol.value),
        lfos: Object.keys(audioEngine.lfos).map(id => ({
            id,
            frequency: audioEngine.lfos[id].frequency,
            type: audioEngine.lfos[id].type
        })),
        effects: effectsRack ? effectsRack.getState() : null,
        additiveSynth: additiveSynthRack ? additiveSynthRack.getState() : null,
        slots: slots.map(s => s.getState())
    };
}

async function handleSavePreset(name) {
    const projectState = getProjectState();
    await presetStorage.savePreset(
        name,
        projectState,
        (sampleKey) => audioEngine.getBlob(sampleKey)
    );
}

async function handleLoadPreset(presetId) {
    // Ensure audio engine is initialized
    if (!audioEngine.initialized) {
        await audioEngine.init();
        setupVisualizer();
    }

    const { preset, samples } = await presetStorage.loadPreset(presetId);

    // Load samples into audioEngine's globalLibrary
    for (const [name, blob] of samples) {
        if (!audioEngine.getBuffer(name)) {
            const arrayBuffer = await blob.arrayBuffer();
            const buffer = await audioEngine.context.decodeAudioData(arrayBuffer);
            audioEngine.globalLibrary.set(name, { buffer, blob });
        }
    }

    // Update sample menus
    const keys = audioEngine.getLibraryKeys();
    slots.forEach(slot => slot.updateMenu(keys));

    // Apply the project state
    applyProjectState(preset.state);

    presetDropdown.showToast(`Loaded: ${preset.name}`);
}

async function handleDeletePreset(presetId) {
    await presetStorage.deletePreset(presetId);
}

initApp();
