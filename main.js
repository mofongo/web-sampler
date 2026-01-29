import { audioEngine } from './src/audio/audioEngine';
import { PlayerUI } from './src/ui/PlayerUI';
import { LFORack } from './src/ui/LFORack';

const rack = document.querySelector('#sampler-rack');
const addSlotBtn = document.querySelector('#add-slot-btn');
const masterVol = document.querySelector('#master-vol');
const exportBtn = document.querySelector('#export-btn');
const importBtn = document.querySelector('#import-btn');

let slots = [];
let lfoRack = null;
const MAX_SLOTS = 16;

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

    exportBtn.addEventListener('click', exportProject);
    importBtn.addEventListener('click', importProject);
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

initApp();
