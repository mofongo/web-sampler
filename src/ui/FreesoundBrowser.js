/**
 * Freesound Browser Modal
 */
import { FreesoundAPI } from '../api/freesoundAPI';
import { audioEngine } from '../audio/audioEngine';

const API_KEY = 'QJH8LINQrUwgdW7v32b9OMQtP608ULJzOpP6aArO';

export class FreesoundBrowser {
    constructor() {
        this.api = new FreesoundAPI(API_KEY);
        this.isOpen = false;
        this.results = [];
        this.nextPageUrl = null;
        this.previewAudio = new Audio();
        this.currentlyPreviewing = null;
        this.searchMode = 'search'; // 'search', 'user', 'pack'
        this.isLoading = false;

        this.createModal();
        this.setupListeners();
    }

    createModal() {
        const modal = document.createElement('div');
        modal.className = 'freesound-modal';
        modal.id = 'freesound-browser';
        modal.innerHTML = `
            <div class="freesound-overlay"></div>
            <div class="freesound-container">
                <div class="freesound-header">
                    <h2 class="freesound-title">FREESOUND BROWSER</h2>
                    <button class="freesound-close" title="Close">&times;</button>
                </div>
                <div class="freesound-search-bar">
                    <div class="search-mode-tabs">
                        <button class="mode-tab active" data-mode="search">Search</button>
                        <button class="mode-tab" data-mode="user">User</button>
                        <button class="mode-tab" data-mode="pack">Pack</button>
                    </div>
                    <div class="search-input-row">
                        <input type="text" class="freesound-input" placeholder="Search sounds...">
                        <button class="freesound-search-btn primary">SEARCH</button>
                    </div>
                </div>
                <div class="freesound-results">
                    <div class="results-grid"></div>
                    <div class="results-loading">Loading...</div>
                    <div class="results-empty">No sounds found</div>
                    <button class="load-more-btn">Load More</button>
                </div>
                <div class="freesound-footer">
                    <span class="freesound-attribution">Powered by Freesound.org</span>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.modal = modal;
    }

    setupListeners() {
        // Close button
        this.modal.querySelector('.freesound-close').addEventListener('click', () => this.close());
        this.modal.querySelector('.freesound-overlay').addEventListener('click', () => this.close());

        // ESC key
        this.escHandler = (e) => {
            if (e.key === 'Escape' && this.isOpen) this.close();
        };
        document.addEventListener('keydown', this.escHandler);

        // Search tabs
        this.modal.querySelectorAll('.mode-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.setSearchMode(e.target.dataset.mode);
            });
        });

        // Search input
        const input = this.modal.querySelector('.freesound-input');
        const searchBtn = this.modal.querySelector('.freesound-search-btn');

        searchBtn.addEventListener('click', () => this.performSearch(input.value));
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this.performSearch(input.value);
        });

        // Load more
        this.modal.querySelector('.load-more-btn').addEventListener('click', () => this.loadMore());

        // Preview audio events
        this.previewAudio.addEventListener('ended', () => {
            this.updatePreviewButton(this.currentlyPreviewing, false);
            this.currentlyPreviewing = null;
        });
    }

    setSearchMode(mode) {
        this.searchMode = mode;
        this.modal.querySelectorAll('.mode-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.mode === mode);
        });

        const input = this.modal.querySelector('.freesound-input');
        const placeholders = {
            search: 'Search sounds...',
            user: 'Enter username...',
            pack: 'Enter pack ID or URL...'
        };
        input.placeholder = placeholders[mode];
        input.value = '';
        input.focus();
    }

    async performSearch(query) {
        if (!query.trim() || this.isLoading) return;

        this.showLoading(true);
        this.clearResults();

        try {
            let data;
            switch (this.searchMode) {
                case 'user':
                    data = await this.api.getUserSounds(query.trim());
                    break;
                case 'pack':
                    const packId = FreesoundAPI.parsePackUrl(query) || query.trim();
                    data = await this.api.getPackSounds(packId);
                    break;
                default:
                    data = await this.api.search(query.trim());
            }

            this.results = data.results || [];
            this.nextPageUrl = data.next;
            this.renderResults();
        } catch (err) {
            console.error('Freesound search error:', err);
            this.showError('Search failed. Please try again.');
        } finally {
            this.showLoading(false);
        }
    }

    async loadMore() {
        if (!this.nextPageUrl || this.isLoading) return;

        this.showLoading(true);
        try {
            const data = await this.api.fetchNextPage(this.nextPageUrl);
            this.results = [...this.results, ...(data.results || [])];
            this.nextPageUrl = data.next;
            this.renderResults();
        } catch (err) {
            console.error('Load more error:', err);
        } finally {
            this.showLoading(false);
        }
    }

    renderResults() {
        const grid = this.modal.querySelector('.results-grid');
        const loadMoreBtn = this.modal.querySelector('.load-more-btn');
        const emptyMsg = this.modal.querySelector('.results-empty');

        grid.innerHTML = '';

        if (this.results.length === 0) {
            emptyMsg.style.display = 'block';
            loadMoreBtn.style.display = 'none';
            return;
        }

        emptyMsg.style.display = 'none';
        loadMoreBtn.style.display = this.nextPageUrl ? 'block' : 'none';

        this.results.forEach(sound => {
            const card = this.createSoundCard(sound);
            grid.appendChild(card);
        });
    }

    createSoundCard(sound) {
        const card = document.createElement('div');
        card.className = 'sound-card';
        card.dataset.soundId = sound.id;

        const previewUrl = sound.previews?.['preview-hq-mp3'] || sound.previews?.['preview-lq-mp3'] || '';
        const waveformUrl = sound.images?.waveform_m || '';
        const duration = this.formatDuration(sound.duration);
        const safeName = this.escapeHtml(sound.name);
        const safeUser = this.escapeHtml(sound.username);

        card.innerHTML = `
            <div class="sound-waveform" style="background-image: url('${waveformUrl}')"></div>
            <div class="sound-info">
                <div class="sound-name" title="${safeName}">${safeName}</div>
                <div class="sound-meta">
                    <span class="sound-user">${safeUser}</span>
                    <span class="sound-duration">${duration}</span>
                </div>
            </div>
            <div class="sound-actions">
                <button class="btn-preview" title="Preview">
                    <span class="play-icon">&#9654;</span>
                </button>
                <button class="btn-load" title="Load into Sampler">+</button>
            </div>
        `;

        // Preview button
        const previewBtn = card.querySelector('.btn-preview');
        previewBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePreview(sound.id, previewUrl);
        });

        // Load button
        const loadBtn = card.querySelector('.btn-load');
        loadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.loadSound(previewUrl, sound.name, sound.id);
        });

        return card;
    }

    togglePreview(soundId, url) {
        if (!url) return;

        if (this.currentlyPreviewing === soundId) {
            // Stop current preview
            this.previewAudio.pause();
            this.previewAudio.currentTime = 0;
            this.updatePreviewButton(soundId, false);
            this.currentlyPreviewing = null;
        } else {
            // Stop previous if any
            if (this.currentlyPreviewing) {
                this.previewAudio.pause();
                this.updatePreviewButton(this.currentlyPreviewing, false);
            }
            // Play new
            this.previewAudio.src = url;
            this.previewAudio.play().catch(err => {
                console.error('Preview playback error:', err);
            });
            this.updatePreviewButton(soundId, true);
            this.currentlyPreviewing = soundId;
        }
    }

    updatePreviewButton(soundId, isPlaying) {
        const card = this.modal.querySelector(`[data-sound-id="${soundId}"]`);
        if (card) {
            const btn = card.querySelector('.btn-preview');
            btn.innerHTML = isPlaying
                ? '<span class="stop-icon">&#9632;</span>'
                : '<span class="play-icon">&#9654;</span>';
            btn.classList.toggle('playing', isPlaying);
        }
    }

    async loadSound(url, name, soundId) {
        if (!url) return;

        const loadBtn = this.modal.querySelector(`[data-sound-id="${soundId}"] .btn-load`);
        if (loadBtn) {
            loadBtn.disabled = true;
            loadBtn.textContent = '...';
        }

        try {
            // Stop preview if playing
            if (this.currentlyPreviewing) {
                this.previewAudio.pause();
                this.updatePreviewButton(this.currentlyPreviewing, false);
                this.currentlyPreviewing = null;
            }

            // Use audioEngine to load the sound
            const safeName = name.replace(/[^a-zA-Z0-9_\-\.]/g, '_');
            const result = await audioEngine.loadFromUrl(url);

            // Rename in library to use original name
            const originalKey = url.split('/').pop();
            if (audioEngine.globalLibrary.has(originalKey)) {
                const data = audioEngine.globalLibrary.get(originalKey);
                audioEngine.globalLibrary.delete(originalKey);
                audioEngine.globalLibrary.set(`${safeName}.mp3`, data);
            }

            // Notify other components
            window.dispatchEvent(new CustomEvent('new-sample-loaded', {
                detail: { name: `${safeName}.mp3` }
            }));

            // Visual feedback
            this.showToast(`Loaded: ${name}`);

            if (loadBtn) {
                loadBtn.textContent = '✓';
                setTimeout(() => {
                    loadBtn.disabled = false;
                    loadBtn.textContent = '+';
                }, 1500);
            }
        } catch (err) {
            console.error('Failed to load sound:', err);
            this.showToast('Failed to load sound');

            if (loadBtn) {
                loadBtn.disabled = false;
                loadBtn.textContent = '+';
            }
        }
    }

    formatDuration(seconds) {
        if (!seconds) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showLoading(show) {
        this.isLoading = show;
        this.modal.querySelector('.results-loading').style.display = show ? 'block' : 'none';
        this.modal.querySelector('.freesound-search-btn').disabled = show;
    }

    clearResults() {
        this.results = [];
        this.nextPageUrl = null;
        this.modal.querySelector('.results-grid').innerHTML = '';
        this.modal.querySelector('.results-empty').style.display = 'none';
        this.modal.querySelector('.load-more-btn').style.display = 'none';
    }

    showError(message) {
        this.showToast(message);
    }

    showToast(message) {
        // Remove existing toast
        const existing = this.modal.querySelector('.freesound-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = 'freesound-toast';
        toast.textContent = message;
        this.modal.querySelector('.freesound-container').appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }

    open() {
        this.modal.classList.add('open');
        this.isOpen = true;
        document.body.style.overflow = 'hidden';
        this.modal.querySelector('.freesound-input').focus();
    }

    close() {
        this.modal.classList.remove('open');
        this.isOpen = false;
        document.body.style.overflow = '';

        // Stop any preview
        if (this.currentlyPreviewing) {
            this.previewAudio.pause();
            this.updatePreviewButton(this.currentlyPreviewing, false);
            this.currentlyPreviewing = null;
        }
    }
}
