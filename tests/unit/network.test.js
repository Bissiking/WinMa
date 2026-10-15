const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createNetworkService } = require('../../src/server/services/network-service');

function createConfig(overrides = {}) {
    return {
        version: '3.2.0-alpha',
        kyros: { enabled: true, baseUrl: 'https://kyros.test' },
        sonoraStudio: { baseUrl: null },
        brainDump: { baseUrl: null },
        harmonix: { baseUrl: null },
        ...overrides
    };
}

test('les services non configurés sont signalés unconfigured sans ping', async () => {
    const calls = [];
    const service = createNetworkService({
        config: createConfig(),
        fetchImplementation: async (url) => { calls.push(url); return new Response('{}'); }
    });

    const services = await service.services();

    assert.equal(calls.length, 1);
    assert.equal(calls[0], 'https://kyros.test');
    assert.deepEqual(services, [
        { id: 'kyros', name: 'Identité Kyros', configured: true, status: 'ok', latencyMs: services[0].latencyMs },
        { id: 'sonora-studio', name: 'Sonora Studio', configured: false, status: 'unconfigured', latencyMs: null },
        { id: 'braindump', name: 'BrainDump', configured: false, status: 'unconfigured', latencyMs: null },
        { id: 'harmonix', name: 'Harmonix', configured: false, status: 'unconfigured', latencyMs: null }
    ]);
    assert.ok(typeof services[0].latencyMs === 'number');
});

test('un service injoignable passe en error avec la latence mesurée', async () => {
    const service = createNetworkService({
        config: createConfig({ harmonix: { baseUrl: 'https://harmonix.test' } }),
        fetchImplementation: async (url) => {
            if (url.includes('harmonix')) throw new Error('network down');
            return new Response('{}');
        }
    });

    const services = await service.services();
    const harmonix = services.find((entry) => entry.id === 'harmonix');

    assert.equal(harmonix.configured, true);
    assert.equal(harmonix.status, 'error');
    assert.ok(typeof harmonix.latencyMs === 'number');
});

test('la snapshot inclut serveur, services et session', async () => {
    const service = createNetworkService({
        config: createConfig(),
        fetchImplementation: async () => new Response('{}')
    });

    const establishedAt = Date.now() - 65_000;
    const snapshot = await service.snapshot({
        headers: { host: 'localhost:3000' },
        protocol: 'http',
        session: {
            user: { id: 'usr_one' },
            establishedAt,
            kyros: { accessTokenExpiresAt: 1234567890, refreshToken: 'refresh-token' }
        }
    });

    assert.equal(snapshot.server.version, '3.2.0-alpha');
    assert.ok(snapshot.server.uptimeSeconds >= 0);
    assert.equal(snapshot.services.length, 4);
    assert.deepEqual(snapshot.session, {
        host: 'localhost:3000',
        protocol: 'http',
        authenticated: true,
        ageSeconds: 65,
        accessTokenExpiresAt: 1234567890,
        refreshTokenPresent: true
    });
});

test('le cache évite de re-pinger les services dans les 30 s', async () => {
    let fetches = 0;
    const service = createNetworkService({
        config: createConfig({ harmonix: { baseUrl: 'https://harmonix.test' } }),
        fetchImplementation: async () => { fetches += 1; return new Response('{}'); }
    });

    await service.services();
    await service.services();

    assert.equal(fetches, 2);
});
