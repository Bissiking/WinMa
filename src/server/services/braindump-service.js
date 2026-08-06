const { HttpError } = require('../utils/http-error');

const NOTE_ID_PATTERN = /^[1-9]\d{0,15}$/;

function createTimeoutSignal(timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    return { signal: controller.signal, clear: () => clearTimeout(timeout) };
}

function createBrainDumpService(config, fetchImplementation = globalThis.fetch) {
    if (!config?.baseUrl || typeof fetchImplementation !== 'function') {
        throw new Error('La configuration BrainDump est requise.');
    }

    const baseUrl = config.baseUrl.replace(/\/$/, '');
    const timeoutMs = config.timeoutMs || 10000;

    async function request(accessToken, pathname, options = {}) {
        if (!accessToken || typeof accessToken !== 'string') {
            throw new HttpError(401, 'KYROS_TOKEN_REQUIRED', 'Un jeton Kyros utilisateur est requis pour accéder à BrainDump.');
        }

        const timeout = createTimeoutSignal(timeoutMs);
        const headers = new Headers(options.headers || {});
        headers.set('accept', 'application/json');
        headers.set('authorization', `Bearer ${accessToken}`);

        try {
            const response = await fetchImplementation(`${baseUrl}${pathname}`, {
                redirect: 'error',
                ...options,
                headers,
                signal: timeout.signal
            });
            const payload = response.status === 204 ? null : await response.json().catch(() => null);
            if (!response.ok) {
                const status = response.status >= 400 && response.status < 500 ? response.status : 502;
                throw new HttpError(status, 'BRAINDUMP_REQUEST_FAILED', payload?.message || payload?.error || 'La requête BrainDump a échoué.');
            }
            if (response.status !== 204 && payload === null) {
                throw new HttpError(502, 'BRAINDUMP_RESPONSE_INVALID', 'BrainDump a renvoyé une réponse invalide.');
            }
            return payload;
        } catch (error) {
            if (error instanceof HttpError) throw error;
            if (error?.name === 'AbortError') {
                throw new HttpError(504, 'BRAINDUMP_TIMEOUT', 'BrainDump met trop de temps à répondre.');
            }
            throw new HttpError(502, 'BRAINDUMP_UNAVAILABLE', 'BrainDump est momentanément indisponible.', { cause: error });
        } finally {
            timeout.clear();
        }
    }

    function noteBody(body) {
        const content = typeof body?.content === 'string' ? body.content.trim() : '';
        if (content.length < 2 || content.length > 5000) {
            throw new HttpError(400, 'BRAINDUMP_CONTENT_INVALID', 'La note doit contenir entre 2 et 5 000 caractères.');
        }
        return { content };
    }

    function noteId(value) {
        const id = String(value || '').trim();
        if (!NOTE_ID_PATTERN.test(id)) {
            throw new HttpError(400, 'BRAINDUMP_NOTE_ID_INVALID', 'Identifiant de note BrainDump invalide.');
        }
        return encodeURIComponent(id);
    }

    function jsonRequest(accessToken, pathname, body) {
        return request(accessToken, pathname, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(noteBody(body))
        });
    }

    return {
        listNotes: (accessToken) => request(accessToken, '/api/braindump/notes'),
        analyze: (accessToken, body) => jsonRequest(accessToken, '/api/braindump/analyze', body),
        createNote: (accessToken, body) => jsonRequest(accessToken, '/api/braindump/notes', body),
        deleteNote: (accessToken, id) => request(accessToken, `/api/braindump/notes/${noteId(id)}`, { method: 'DELETE' })
    };
}

module.exports = { createBrainDumpService };
