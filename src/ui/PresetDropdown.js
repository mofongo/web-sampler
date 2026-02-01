import { presetStorage } from '../storage/presetStorage.js';

export class PresetDropdown {
    constructor() {
        this.isOpen = false;
        this.presets = [];
        this.onSave = null;
        this.onLoad = null;
        this.onDelete = null;

        this.createElement();
        this.setupListeners();
    }

    createElement() {
        this.element = document.createElement('div');
        this.element.className = 'preset-dropdown';
        this.element.innerHTML = `
            <button class="preset-dropdown-btn" title="Presets">
                PRESETS <span class="dropdown-arrow">▼</span>
            </button>
            <div class="preset-dropdown-menu">
                <div class="preset-menu-header">
                    <button class="preset-save-btn primary">+ SAVE PRESET</button>
                </div>
                <div class="preset-list"></div>
                <div class="preset-list-empty">No saved presets</div>
            </div>
        `;

        this.btn = this.element.querySelector('.preset-dropdown-btn');
        this.menu = this.element.querySelector('.preset-dropdown-menu');
        this.saveBtn = this.element.querySelector('.preset-save-btn');
        this.listEl = this.element.querySelector('.preset-list');
        this.emptyEl = this.element.querySelector('.preset-list-empty');
    }

    setupListeners() {
        this.btn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggle();
        });

        document.addEventListener('click', (e) => {
            if (this.isOpen && !this.element.contains(e.target)) {
                this.close();
            }
        });

        this.saveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showSaveDialog();
        });

        this.listEl.addEventListener('click', (e) => {
            const item = e.target.closest('.preset-item');
            if (!item) return;

            const presetId = item.dataset.id;

            if (e.target.closest('.preset-delete-btn')) {
                e.stopPropagation();
                this.confirmDelete(presetId, item.querySelector('.preset-name').textContent);
            } else {
                this.handleLoad(presetId);
            }
        });
    }

    async refreshPresets() {
        try {
            this.presets = await presetStorage.getAllPresets();
            this.renderList();
        } catch (err) {
            console.error('Failed to load presets:', err);
        }
    }

    renderList() {
        if (this.presets.length === 0) {
            this.listEl.innerHTML = '';
            this.emptyEl.style.display = 'block';
            return;
        }

        this.emptyEl.style.display = 'none';
        this.listEl.innerHTML = this.presets.map(preset => `
            <div class="preset-item" data-id="${preset.id}">
                <span class="preset-name">${this.escapeHtml(preset.name)}</span>
                <span class="preset-date">${this.formatDate(preset.createdAt)}</span>
                <button class="preset-delete-btn" title="Delete">×</button>
            </div>
        `).join('');
    }

    formatDate(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;

        if (diff < 86400000 && date.getDate() === now.getDate()) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    open() {
        this.isOpen = true;
        this.element.classList.add('open');
        this.refreshPresets();
    }

    close() {
        this.isOpen = false;
        this.element.classList.remove('open');
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    showSaveDialog() {
        const name = prompt('Enter preset name:');
        if (name && name.trim()) {
            this.handleSave(name.trim());
        }
    }

    async handleSave(name) {
        if (this.onSave) {
            this.saveBtn.disabled = true;
            this.saveBtn.textContent = 'SAVING...';
            try {
                await this.onSave(name);
                await this.refreshPresets();
                this.showToast(`Saved: ${name}`);
            } catch (err) {
                console.error('Failed to save preset:', err);
                this.showToast('Failed to save preset', 'error');
            } finally {
                this.saveBtn.disabled = false;
                this.saveBtn.textContent = '+ SAVE PRESET';
            }
        }
    }

    async handleLoad(presetId) {
        if (this.onLoad) {
            const item = this.listEl.querySelector(`[data-id="${presetId}"]`);
            if (item) item.classList.add('loading');

            try {
                await this.onLoad(presetId);
                this.close();
            } catch (err) {
                console.error('Failed to load preset:', err);
                this.showToast('Failed to load preset', 'error');
            } finally {
                if (item) item.classList.remove('loading');
            }
        }
    }

    confirmDelete(presetId, name) {
        if (confirm(`Delete preset "${name}"?`)) {
            this.handleDelete(presetId);
        }
    }

    async handleDelete(presetId) {
        if (this.onDelete) {
            try {
                await this.onDelete(presetId);
                await this.refreshPresets();
                this.showToast('Preset deleted');
            } catch (err) {
                console.error('Failed to delete preset:', err);
                this.showToast('Failed to delete preset', 'error');
            }
        }
    }

    showToast(message, type = 'success') {
        const existing = document.querySelector('.preset-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.className = `preset-toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => toast.remove(), 2500);
    }
}
