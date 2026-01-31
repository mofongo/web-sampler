/**
 * Freesound API Client
 */
const BASE_URL = 'https://freesound.org/apiv2';

class FreesoundAPI {
    constructor(apiKey) {
        this.apiKey = apiKey;
    }

    async search(query, options = {}) {
        const params = new URLSearchParams({
            token: this.apiKey,
            query: query,
            fields: 'id,name,duration,username,previews,images,tags,description',
            page_size: options.pageSize || 15,
            page: options.page || 1
        });

        if (options.filter) {
            params.set('filter', options.filter);
        }

        const response = await fetch(`${BASE_URL}/search/text/?${params}`);
        if (!response.ok) {
            throw new Error(`Freesound API error: ${response.status}`);
        }
        return response.json();
    }

    async getUserSounds(username, options = {}) {
        const params = new URLSearchParams({
            token: this.apiKey,
            fields: 'id,name,duration,username,previews,images,tags',
            page_size: options.pageSize || 15,
            page: options.page || 1
        });

        const response = await fetch(`${BASE_URL}/users/${encodeURIComponent(username)}/sounds/?${params}`);
        if (!response.ok) {
            throw new Error(`Freesound API error: ${response.status}`);
        }
        return response.json();
    }

    async getPackSounds(packId, options = {}) {
        const params = new URLSearchParams({
            token: this.apiKey,
            fields: 'id,name,duration,username,previews,images,tags',
            page_size: options.pageSize || 15,
            page: options.page || 1
        });

        const response = await fetch(`${BASE_URL}/packs/${packId}/sounds/?${params}`);
        if (!response.ok) {
            throw new Error(`Freesound API error: ${response.status}`);
        }
        return response.json();
    }

    async getSoundDetails(soundId) {
        const params = new URLSearchParams({
            token: this.apiKey,
            fields: 'id,name,duration,username,previews,images,tags,description,license'
        });

        const response = await fetch(`${BASE_URL}/sounds/${soundId}/?${params}`);
        if (!response.ok) {
            throw new Error(`Freesound API error: ${response.status}`);
        }
        return response.json();
    }

    async fetchNextPage(nextUrl) {
        if (!nextUrl) return null;

        const url = new URL(nextUrl);
        url.searchParams.set('token', this.apiKey);

        const response = await fetch(url.toString());
        if (!response.ok) {
            throw new Error(`Freesound API error: ${response.status}`);
        }
        return response.json();
    }

    // Extract pack ID from URL like https://freesound.org/people/user/packs/12345/
    static parsePackUrl(url) {
        const match = url.match(/packs\/(\d+)/);
        return match ? match[1] : null;
    }
}

export { FreesoundAPI };
