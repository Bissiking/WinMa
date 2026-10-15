const path = require('node:path');
const { HttpError } = require('../utils/http-error');

const PUBLIC_ID_PATTERN = /^[a-zA-Z0-9._-]{1,160}$/;
const COVER_NAME_PATTERN = /^[a-zA-Z0-9._-]{1,200}\.(?:avif|jpe?g|png|webp)$/i;
const PASSTHROUGH_HEADERS = [
    'accept-ranges',
    'cache-control',
    'content-length',
    'content-range',
    'content-type',
    'etag',
    'last-modified'
];

function createTimeoutSignal(timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    return { signal: controller.signal, clear: () => clearTimeout(timeout) };
}

function normalizeTrack(track) {
    if (!track || typeof track !== 'object') return null;
    const id = String(track.id ?? '').trim();
    if (!PUBLIC_ID_PATTERN.test(id) || track.visibility && track.visibility !== 'public') return null;

    let coverUrl = null;
    if (track.cover) {
        try {
            const coverName = path.posix.basename(new URL(String(track.cover), 'https://harmonix.invalid').pathname);
            if (COVER_NAME_PATTERN.test(coverName)) {
                coverUrl = `/api/harmonix/covers/${encodeURIComponent(coverName)}`;
            }
        } catch {
            coverUrl = null;
        }
    }

    const duration = Number(track.duration ?? track.duration_seconds);
    return {
        id,
        title: String(track.title || track.name || 'Sans titre').trim(),
        artist: String(track.artist || track.artist_name || 'Inconnu').trim(),
        album: String(track.album || track.album_name || '').trim(),
        duration: Number.isFinite(duration) && duration > 0 ? duration : 0,
        coverUrl,
        streamUrl: `/api/harmonix/tracks/${encodeURIComponent(id)}/stream`
    };
}

function createHarmonixService(config, fetchImplementation = globalThis.fetch) {
    if (!config?.baseUrl || typeof fetchImplementation !== 'function') {
        throw new Error('La configuration Harmonix est requise.');
    }

    const baseUrl = config.baseUrl.replace(/\/$/, '');
    const timeoutMs = config.timeoutMs || 10000;

    async function request(pathname, options = {}) {
        const timeout = createTimeoutSignal(timeoutMs);
        try {
            return await fetchImplementation(`${baseUrl}${pathname}`, {
                redirect: 'follow',
                ...options,
                signal: timeout.signal
            });
        } catch (error) {
            if (error?.name === 'AbortError') {
                throw new HttpError(504, 'HARMONIX_TIMEOUT', 'Harmonix met trop de temps à répondre.');
            }
            throw new HttpError(502, 'HARMONIX_UNAVAILABLE', 'Harmonix est momentanément indisponible.', { cause: error });
        } finally {
            timeout.clear();
        }
    }

    async function listTracks() {
        const response = await request('/api/sonora/tracks', {
            headers: { accept: 'application/json' }
        });
        if (!response.ok) {
            throw new HttpError(502, 'HARMONIX_CATALOG_UNAVAILABLE', 'Le catalogue Harmonix est indisponible.');
        }

        let payload;
        try {
            payload = await response.json();
        } catch (error) {
            throw new HttpError(502, 'HARMONIX_RESPONSE_INVALID', 'Harmonix a renvoyé une réponse invalide.', { cause: error });
        }
        const rows = Array.isArray(payload)
            ? payload
            : payload?.tracks || payload?.items || payload?.results || payload?.data || [];
        return Array.isArray(rows) ? rows.map(normalizeTrack).filter(Boolean) : [];
    }

    async function getStream(trackId, range) {
        const id = String(trackId ?? '').trim();
        if (!PUBLIC_ID_PATTERN.test(id)) {
            throw new HttpError(400, 'HARMONIX_TRACK_INVALID', 'Identifiant de piste Harmonix invalide.');
        }
        const headers = {};
        if (range) headers.range = range;
        const response = await request(`/api/sonora/stream/${encodeURIComponent(id)}`, { headers });
        if (!response.ok && response.status !== 206) {
            throw new HttpError(
                response.status === 404 ? 404 : 502,
                response.status === 404 ? 'HARMONIX_TRACK_NOT_FOUND' : 'HARMONIX_STREAM_UNAVAILABLE',
                response.status === 404 ? 'Cette piste Harmonix est introuvable.' : 'La lecture Harmonix est indisponible.'
            );
        }
        return response;
    }

    async function getCover(coverName) {
        const name = String(coverName ?? '').trim();
        if (!COVER_NAME_PATTERN.test(name)) {
            throw new HttpError(400, 'HARMONIX_COVER_INVALID', 'Nom de cover Harmonix invalide.');
        }
        const response = await request(`/covers/${encodeURIComponent(name)}`, {
            headers: { accept: 'image/avif,image/webp,image/png,image/jpeg' }
        });
        if (!response.ok) {
            throw new HttpError(
                response.status === 404 ? 404 : 502,
                response.status === 404 ? 'HARMONIX_COVER_NOT_FOUND' : 'HARMONIX_COVER_UNAVAILABLE',
                response.status === 404 ? 'Cette cover Harmonix est introuvable.' : 'La cover Harmonix est indisponible.'
            );
        }
        if (!String(response.headers.get('content-type') || '').startsWith('image/')) {
            throw new HttpError(502, 'HARMONIX_COVER_INVALID', 'Harmonix a renvoyé une cover invalide.');
        }
        return response;
    }

    return { listTracks, getStream, getCover, passthroughHeaders: PASSTHROUGH_HEADERS };
}

module.exports = { createHarmonixService };
