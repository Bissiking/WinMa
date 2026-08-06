const { HttpError } = require('../utils/http-error');

const ID_PATTERN = /^[a-zA-Z0-9._-]{1,160}$/;

function createTimeoutSignal(timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    return { signal: controller.signal, clear: () => clearTimeout(timeout) };
}

function createSonoraStudioService(config, fetchImplementation = globalThis.fetch) {
    if (!config?.baseUrl || typeof fetchImplementation !== 'function') {
        throw new Error('La configuration Sonora Studio est requise.');
    }

    const baseUrl = config.baseUrl.replace(/\/$/, '');
    const timeoutMs = config.timeoutMs || 15000;

    async function upstream(pathname, options = {}) {
        const timeout = createTimeoutSignal(timeoutMs);
        try {
            return await fetchImplementation(`${baseUrl}${pathname}`, {
                redirect: 'error',
                ...options,
                signal: timeout.signal
            });
        } catch (error) {
            if (error?.name === 'AbortError') {
                throw new HttpError(504, 'SONORA_TIMEOUT', 'Sonora met trop de temps à répondre.');
            }
            throw new HttpError(502, 'SONORA_UNAVAILABLE', 'Sonora est momentanément indisponible.', { cause: error });
        } finally {
            timeout.clear();
        }
    }

    async function request(accessToken, pathname, options = {}) {
        if (!accessToken || typeof accessToken !== 'string') {
            throw new HttpError(401, 'KYROS_TOKEN_REQUIRED', 'Un jeton Kyros utilisateur est requis pour accéder à Sonora.');
        }
        const headers = new Headers(options.headers || {});
        headers.set('accept', 'application/json');
        headers.set('authorization', `Bearer ${accessToken}`);
        const response = await upstream(pathname, { ...options, headers });
        if (!response.ok) {
            const payload = await response.json().catch(() => null);
            const status = response.status >= 400 && response.status < 500 ? response.status : 502;
            throw new HttpError(status, 'SONORA_REQUEST_FAILED', payload?.message || payload?.error || 'La requête Sonora a échoué.');
        }
        if (response.status === 204) return null;
        return response.json().catch((error) => {
            throw new HttpError(502, 'SONORA_RESPONSE_INVALID', 'Sonora a renvoyé une réponse invalide.', { cause: error });
        });
    }

    function jsonRequest(accessToken, pathname, method, body) {
        return request(accessToken, pathname, {
            method,
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body || {})
        });
    }

    function safeId(value) {
        const id = String(value || '').trim();
        if (!ID_PATTERN.test(id)) throw new HttpError(400, 'SONORA_ID_INVALID', 'Identifiant Sonora invalide.');
        return encodeURIComponent(id);
    }

    return {
        status: (accessToken) => ({ authenticated: Boolean(accessToken), apiVersion: '5.0.0', authentication: 'kyros' }),
        getIdentity: (accessToken) => request(accessToken, '/api/auth/me'),
        listTracks: (accessToken, { q = '', page = 1, limit = 50, visibility = '' } = {}) => {
            const query = new URLSearchParams({ q, page: String(page), limit: String(limit) });
            if (visibility === 'public' || visibility === 'private') query.set('visibility', visibility);
            return request(accessToken, `/api/studio/music?${query}`);
        },
        listAlbums: (accessToken) => request(accessToken, '/api/albums'),
        createAlbum: (accessToken, body) => jsonRequest(accessToken, '/api/albums', 'POST', body),
        updateAlbum: (accessToken, id, body) => jsonRequest(accessToken, `/api/albums/${safeId(id)}`, 'PATCH', body),
        deleteAlbum: (accessToken, id) => request(accessToken, `/api/albums/${safeId(id)}`, { method: 'DELETE' }),
        listPlaylists: (accessToken) => request(accessToken, '/api/playlists'),
        createPlaylist: (accessToken, body) => jsonRequest(accessToken, '/api/playlists', 'POST', body),
        updatePlaylist: (accessToken, id, body) => jsonRequest(accessToken, `/api/playlists/${safeId(id)}`, 'PATCH', body),
        deletePlaylist: (accessToken, id) => request(accessToken, `/api/playlists/${safeId(id)}`, { method: 'DELETE' }),
        updateTrack: (accessToken, id, body) => jsonRequest(accessToken, `/api/studio/music/${safeId(id)}`, 'PATCH', body),
        bulkTrackVisibility: (accessToken, body) => jsonRequest(accessToken, '/api/studio/music/bulk-visibility', 'PATCH', body),
        deleteTrack: (accessToken, id, deleteFile = false) => request(accessToken, `/api/studio/music/${safeId(id)}?deleteFile=${deleteFile ? 'true' : 'false'}`, { method: 'DELETE' }),
        uploadTrack: (accessToken, file, fields) => {
            const body = new FormData();
            body.append('file', new Blob([file.buffer], { type: file.mimetype }), file.originalname);
            for (const [key, value] of Object.entries(fields || {})) {
                if (value !== undefined && value !== null && value !== '') body.append(key, String(value));
            }
            return request(accessToken, '/api/upload/audio', { method: 'POST', body });
        }
    };
}

module.exports = { createSonoraStudioService };
