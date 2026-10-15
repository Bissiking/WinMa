// src/server/services/build-version-service.js
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const VERSION_PLACEHOLDER = '__LUMA_BUILD__';
const DEFAULT_REFRESH_MS = 1000;

function collectSignatures(root, directory, signatures) {
    let entries;
    try {
        entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
        return signatures;
    }

    for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            collectSignatures(root, fullPath, signatures);
            continue;
        }
        if (!entry.isFile()) continue;
        try {
            const stats = fs.statSync(fullPath);
            signatures.push(`${path.relative(root, fullPath).split(path.sep).join('/')}|${stats.size}|${stats.mtimeMs}`);
        } catch {
            signatures.push(`${path.relative(root, fullPath)}|unreadable|0`);
        }
    }

    return signatures;
}

function createBuildVersionService({ projectRoot, refreshMs = DEFAULT_REFRESH_MS } = {}) {
    if (!projectRoot) {
        throw new Error('La racine du projet est requise pour calculer la version de build.');
    }

    let cached = { value: null, at: 0 };

    function compute() {
        const signatures = collectSignatures(projectRoot, path.join(projectRoot, 'sources'), []);

        for (const fileName of ['index.html', 'package.json']) {
            try {
                const stats = fs.statSync(path.join(projectRoot, fileName));
                signatures.push(`${fileName}|${stats.size}|${stats.mtimeMs}`);
            } catch {
                signatures.push(`${fileName}|missing|0`);
            }
        }

        signatures.sort();
        return crypto.createHash('sha256').update(signatures.join('\n')).digest('hex').slice(0, 16);
    }

    return {
        get() {
            const now = Date.now();
            if (cached.value && now - cached.at < refreshMs) return cached.value;
            cached = { value: compute(), at: now };
            return cached.value;
        },
        invalidate() {
            cached = { value: null, at: 0 };
        }
    };
}

function renderServiceWorker(source, version) {
    if (typeof source !== 'string') return source;
    const token = `"${VERSION_PLACEHOLDER}"`;
    if (!source.includes(token)) return source;
    return source.replace(token, JSON.stringify(String(version || 'dev')));
}

module.exports = { createBuildVersionService, renderServiceWorker, VERSION_PLACEHOLDER };
