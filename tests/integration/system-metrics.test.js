// tests/integration/system-metrics.test.js
// GET /api/system/metrics : session obligatoire, contrat du payload (périmètre
// explicite, sources déclarées, aucune valeur hors bornes).
const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { createApp } = require('../../src/server/app');
const { createTestConfig } = require('../helpers/test-config');
const { createFakeKyros, loginAs } = require('../helpers/fake-kyros');
const { extractCookie, startTestServer, stopTestServer } = require('../helpers/test-server');

const config = createTestConfig({ appBaseUrl: 'http://127.0.0.1:4011' });
const fake = createFakeKyros(config);
let server;
let baseUrl;
let cookie;

before(async () => {
    ({ server, baseUrl } = await startTestServer(await createApp({ config, fetchImplementation: fake.fetchImplementation })));
    ({ cookie } = await loginAs(baseUrl, fake, { extractCookie }));
});

after(async () => {
    if (server) await stopTestServer(server);
});

test('les métriques système exigent une session authentifiée', async () => {
    const response = await fetch(`${baseUrl}/api/system/metrics`);
    assert.equal(response.status, 401);
});

test('le payload expose périmètre, sources et valeurs bornées', async () => {
    const response = await fetch(`${baseUrl}/api/system/metrics`, {
        headers: { cookie, accept: 'application/json' }
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.success, true);
    const data = payload.data;

    assert.ok(Number.isFinite(Date.parse(data.timestamp)), 'horodatage ISO valide');
    assert.ok(['host', 'container', 'probe'].includes(data.meta.scope), 'périmètre déclaré');
    assert.equal(typeof data.meta.containerized, 'boolean');
    assert.equal(typeof data.meta.probe, 'boolean');

    const validSources = ['host-os', 'cgroup-v2', 'cgroup-v1', 'unavailable'];
    assert.ok(validSources.includes(data.meta.sources.percent));
    assert.ok(validSources.includes(data.meta.sources.cores));
    assert.ok(validSources.includes(data.meta.sources.memory));
    assert.ok(['host-os', 'unavailable'].includes(data.meta.sources.loadAverage));

    if (data.cpu.percent != null) assert.ok(data.cpu.percent >= 0 && data.cpu.percent <= 100);
    if (data.cpu.logicalCores != null) assert.ok(data.cpu.logicalCores > 0);
    if (data.cpu.loadAverage != null) {
        assert.equal(data.cpu.loadAverage.length, 3);
        data.cpu.loadAverage.forEach((value) => assert.ok(Number.isFinite(value)));
    }
    if (data.memory.totalBytes != null) {
        assert.ok(data.memory.totalBytes > 0);
        assert.ok(data.memory.usedBytes >= 0 && data.memory.usedBytes <= data.memory.totalBytes);
    }
    if (data.memory.percent != null) assert.ok(data.memory.percent >= 0 && data.memory.percent <= 100);

    assert.ok(data.runtime.uptimeSeconds >= 0);
    assert.ok(data.runtime.processMemoryBytes > 0);
    assert.equal(data.user.username, 'matheo');
    assert.equal(data.user.displayName, 'Matheo');
});
