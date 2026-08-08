const { HttpError } = require('../utils/http-error');

const MAX_WINDOWS = 100;
const ALLOWED_STATES = new Set(['normal', 'minimized', 'maximized', 'snap-left', 'snap-right']);
const ALLOWED_KEYS = new Set(['id', 'instanceKey', 'appId', 'name', 'icon', 'logo', 'state', 'startedAt', 'options', 'bounds']);

function sanitizeWindows(windows) {
    if (!Array.isArray(windows)) {
        throw new HttpError(400, 'SESSION_WINDOWS_INVALID', 'La session doit contenir une liste de fenêtres.');
    }
    if (windows.length > MAX_WINDOWS) {
        throw new HttpError(400, 'SESSION_WINDOWS_TOO_LARGE', 'La session contient trop de fenêtres.');
    }

    return windows
        .filter((entry) => entry && typeof entry === 'object' && typeof entry.appId === 'string')
        .map((entry) => {
            const out = {};
            for (const key of ALLOWED_KEYS) {
                if (key in entry) out[key] = entry[key];
            }
            if (typeof out.id !== 'string') out.id = null;
            if (typeof out.instanceKey !== 'string') out.instanceKey = out.appId;
            if (typeof out.name !== 'string') out.name = out.appId;
            if (!ALLOWED_STATES.has(out.state)) out.state = 'normal';
            if (out.bounds && typeof out.bounds === 'object') {
                const bounds = {};
                for (const dimension of ['left', 'top', 'width', 'height']) {
                    if (Number.isFinite(out.bounds[dimension])) bounds[dimension] = out.bounds[dimension];
                }
                out.bounds = bounds;
            } else {
                out.bounds = null;
            }
            return out;
        });
}

function createWindowSessionService(repository) {
    async function read(ownerKey) {
        const stored = repository.find(ownerKey);
        if (!stored) return { windows: [], updatedAt: null };
        let windows;
        try {
            windows = JSON.parse(stored.windowsJson);
        } catch {
            windows = [];
        }
        return { windows: Array.isArray(windows) ? windows : [], updatedAt: stored.updatedAt };
    }

    async function update(ownerKey, raw) {
        const windows = sanitizeWindows(raw?.windows);
        const updatedAt = new Date().toISOString();
        repository.upsert(ownerKey, JSON.stringify(windows), updatedAt);
        return { windows, updatedAt };
    }

    async function clear(ownerKey) {
        repository.remove(ownerKey);
        return { windows: [], updatedAt: null };
    }

    return { read, update, clear };
}

module.exports = { createWindowSessionService, sanitizeWindows };
