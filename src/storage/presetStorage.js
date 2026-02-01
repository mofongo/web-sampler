const DB_NAME = 'poly-sampler-presets';
const DB_VERSION = 1;

class PresetStorage {
    constructor() {
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Presets store
                if (!db.objectStoreNames.contains('presets')) {
                    const presetsStore = db.createObjectStore('presets', { keyPath: 'id' });
                    presetsStore.createIndex('name', 'name', { unique: true });
                    presetsStore.createIndex('createdAt', 'createdAt', { unique: false });
                }

                // Samples store (audio blobs)
                if (!db.objectStoreNames.contains('samples')) {
                    db.createObjectStore('samples', { keyPath: 'name' });
                }
            };
        });
    }

    generateId() {
        return crypto.randomUUID ? crypto.randomUUID() :
            'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });
    }

    async savePreset(name, projectState, getSampleBlob) {
        const tx = this.db.transaction(['presets', 'samples'], 'readwrite');
        const presetsStore = tx.objectStore('presets');
        const samplesStore = tx.objectStore('samples');

        // Extract sample keys from slots
        const sampleKeys = projectState.slots
            .map(slot => slot.sampleKey)
            .filter(key => key);

        // Check if preset with this name exists
        const existingPreset = await this._getByIndex(presetsStore, 'name', name);
        const id = existingPreset ? existingPreset.id : this.generateId();

        // Save samples (deduplicated)
        for (const sampleKey of sampleKeys) {
            const existing = await this._get(samplesStore, sampleKey);
            if (!existing) {
                const blob = getSampleBlob(sampleKey);
                if (blob) {
                    samplesStore.put({
                        name: sampleKey,
                        blob: blob,
                        createdAt: Date.now()
                    });
                }
            }
        }

        // Save preset
        const preset = {
            id,
            name,
            createdAt: existingPreset ? existingPreset.createdAt : Date.now(),
            updatedAt: Date.now(),
            state: projectState,
            sampleKeys: [...new Set(sampleKeys)]
        };

        presetsStore.put(preset);

        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve(preset);
            tx.onerror = () => reject(tx.error);
        });
    }

    async loadPreset(presetId) {
        const tx = this.db.transaction(['presets', 'samples'], 'readonly');
        const presetsStore = tx.objectStore('presets');
        const samplesStore = tx.objectStore('samples');

        const preset = await this._get(presetsStore, presetId);
        if (!preset) {
            throw new Error('Preset not found');
        }

        const samples = new Map();
        for (const sampleKey of preset.sampleKeys) {
            const sampleData = await this._get(samplesStore, sampleKey);
            if (sampleData) {
                samples.set(sampleKey, sampleData.blob);
            }
        }

        return { preset, samples };
    }

    async deletePreset(presetId) {
        const tx = this.db.transaction(['presets'], 'readwrite');
        const presetsStore = tx.objectStore('presets');

        presetsStore.delete(presetId);

        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    async getAllPresets() {
        const tx = this.db.transaction(['presets'], 'readonly');
        const store = tx.objectStore('presets');
        const index = store.index('createdAt');

        return new Promise((resolve, reject) => {
            const request = index.openCursor(null, 'prev'); // Newest first
            const presets = [];

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    const { id, name, createdAt, sampleKeys } = cursor.value;
                    presets.push({
                        id,
                        name,
                        createdAt,
                        slotCount: cursor.value.state?.slots?.length || 0,
                        sampleCount: sampleKeys?.length || 0
                    });
                    cursor.continue();
                } else {
                    resolve(presets);
                }
            };
            request.onerror = () => reject(request.error);
        });
    }

    _get(store, key) {
        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    _getByIndex(store, indexName, value) {
        return new Promise((resolve, reject) => {
            const index = store.index(indexName);
            const request = index.get(value);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}

export const presetStorage = new PresetStorage();
