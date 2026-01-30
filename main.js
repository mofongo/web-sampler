import { audioEngine } from './src/audio/audioEngine';
import { PlayerUI } from './src/ui/PlayerUI';
import { LFORack } from './src/ui/LFORack';

const rack = document.querySelector('#sampler-rack');
const addSlotBtn = document.querySelector('#add-slot-btn');
const masterVol = document.querySelector('#master-vol');

let slots = [];
let lfoRack = null;
const MAX_SLOTS = 16;
const STORAGE_KEY = 'poly-sampler-state';
let saveTimeout = null;

async function initApp() {
    // Initial slots
    for (let i = 0; i < 4; i++) {
        addSlot();
    }

    // Initialize LFO Rack
    lfoRack = new LFORack('lfo-rack');

    // Initialize Audio on first interaction
    document.addEventListener('mousedown', async () => {
        if (!audioEngine.initialized) {
            await audioEngine.init();

            // Preload default samples
            // Since we can't scan the FS in the browser, we hardcode the known files from the /audio folder
            const defaults = [
                '/audio/counting-to-10.wav',
                '/audio/water.wav'
            ];

            try {
                // Load all defaults
                await Promise.all(defaults.map(url => audioEngine.loadFromUrl(url)));

                // Update all slots with the new keys
                const keys = audioEngine.getLibraryKeys();
                slots.forEach(slot => slot.updateMenu(keys));

                // Try to restore from localStorage, otherwise use default preset
                const restored = loadFromLocalStorage();
                if (!restored && slots[0]) {
                    // Default preset: Slot 1 -> counting-to-10.wav
                    slots[0].setState({
                        slotId: 1,
                        sampleKey: 'counting-to-10.wav',
                        settings: slots[0].voice.settings
                    });
                }
            } catch (err) {
                console.error("Failed to load default samples", err);
            }

            setupVisualizer();
        }
    }, { once: true });

    // Listeners
    addSlotBtn.addEventListener('click', () => {
        if (slots.length < MAX_SLOTS) {
            addSlot();
            saveToLocalStorage();
        } else {
            alert('Maximum 16 slots reached.');
        }
    });

    masterVol.addEventListener('input', (e) => {
        audioEngine.setMasterVolume(parseFloat(e.target.value));
        saveToLocalStorage();
    });

    window.addEventListener('new-sample-loaded', () => {
        const keys = audioEngine.getLibraryKeys();
        slots.forEach(slot => slot.updateMenu(keys));
        saveToLocalStorage();
    });

    // Listen for state changes from player slots
    window.addEventListener('slot-state-changed', () => {
        saveToLocalStorage();
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

function applyProjectState(project, skipSave = false) {
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

    // Match slots
    project.slots.forEach((slotData, index) => {
        if (slots[index]) {
            slots[index].setState(slotData);
        } else if (index < MAX_SLOTS) {
            const slot = addSlot();
            slot.setState(slotData);
        }
    });

    if (!skipSave) {
        saveToLocalStorage();
    }
}

function getProjectState() {
    return {
        masterVolume: parseFloat(masterVol.value),
        lfos: Object.keys(audioEngine.lfos).map(id => ({
            id,
            frequency: audioEngine.lfos[id].frequency,
            type: audioEngine.lfos[id].type
        })),
        slots: slots.map(s => s.getState())
    };
}

function saveToLocalStorage() {
    // Debounce saves to avoid excessive writes
    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    saveTimeout = setTimeout(() => {
        try {
            const state = getProjectState();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (err) {
            console.warn('Failed to save state to localStorage:', err);
        }
    }, 500);
}

function loadFromLocalStorage() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const state = JSON.parse(saved);
            applyProjectState(state, true);
            return true;
        }
    } catch (err) {
        console.warn('Failed to load state from localStorage:', err);
    }
    return false;
}

initApp();
