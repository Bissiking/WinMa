// src/server/services/network-service.js
const SERVICE_PING_TIMEOUT_MS = 3000;
const CACHE_TTL_MS = 30_000;

function createNetworkService({ config, fetchImplementation = globalThis.fetch }) {
    // Cache mémoire 30 s : les pings vers les services distants sont coûteux
    // et l'info n'a pas besoin d'être à la seconde près.
    let cache = { services: null, fetchedAt: 0 };

    async function ping(baseUrl) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), SERVICE_PING_TIMEOUT_MS);
        const startedAt = Date.now();
        try {
            await fetchImplementation(baseUrl, { method: 'GET', signal: controller.signal, redirect: 'manual' });
            return { status: 'ok', latencyMs: Date.now() - startedAt };
        } catch {
            return { status: 'error', latencyMs: Date.now() - startedAt };
        } finally {
            clearTimeout(timeout);
        }
    }

    function serviceDefinitions() {
        const definitions = [
            { id: 'kyros', name: 'Identité Kyros', baseUrl: config.kyros?.baseUrl, configured: Boolean(config.kyros?.enabled) },
            { id: 'sonora-studio', name: 'Sonora Studio', baseUrl: config.sonoraStudio?.baseUrl, configured: Boolean(config.sonoraStudio?.baseUrl) },
            { id: 'braindump', name: 'BrainDump', baseUrl: config.brainDump?.baseUrl, configured: Boolean(config.brainDump?.baseUrl) },
            { id: 'harmonix', name: 'Harmonix', baseUrl: config.harmonix?.baseUrl, configured: Boolean(config.harmonix?.baseUrl) }
        ];
        return definitions;
    }

    async function services() {
        const now = Date.now();
        if (cache.services && now - cache.fetchedAt < CACHE_TTL_MS) {
            return cache.services;
        }

        const results = await Promise.all(serviceDefinitions().map(async (definition) => {
            if (!definition.configured || !definition.baseUrl) {
                return { id: definition.id, name: definition.name, configured: false, status: 'unconfigured', latencyMs: null };
            }
            const probe = await ping(definition.baseUrl);
            return { id: definition.id, name: definition.name, configured: true, status: probe.status, latencyMs: probe.latencyMs };
        }));

        cache = { services: results, fetchedAt: now };
        return results;
    }

    async function snapshot(req) {
        const kyrosSession = req.session?.kyros || {};
        const establishedAt = req.session?.establishedAt || null;
        return {
            server: {
                version: config.version,
                uptimeSeconds: Math.round(process.uptime())
            },
            services: await services(),
            session: {
                host: req.headers?.host || null,
                protocol: req.protocol || null,
                authenticated: Boolean(req.session?.user),
                ageSeconds: establishedAt ? Math.max(0, Math.round((Date.now() - establishedAt) / 1000)) : null,
                accessTokenExpiresAt: kyrosSession.accessTokenExpiresAt || null,
                refreshTokenPresent: Boolean(kyrosSession.refreshToken)
            }
        };
    }

    return { snapshot, services };
}

module.exports = { createNetworkService };
