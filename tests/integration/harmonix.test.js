const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const { createApp } = require('../../src/server/app');
const { createTestConfig } = require('../helpers/test-config');
const { startTestServer, stopTestServer } = require('../helpers/test-server');

let baseUrl;
let server;
let requests;

before(async () => {
    requests = [];
    const fetchImplementation = async (url, options = {}) => {
        requests.push({ url, options });
        if (url.endsWith('/api/sonora/tracks')) {
            return Response.json([
                {
                    id: 'en_thorie',
                    title: 'En Théorie',
                    artist: 'Mathéo',
                    album: 'AUTOPILOT',
                    duration: 204.768,
                    cover: '/covers/en_thorie.png',
                    visibility: 'public'
                },
                { id: 'private_track', title: 'Privée', visibility: 'private' }
            ]);
        }
        if (url.endsWith('/api/sonora/stream/en_thorie')) {
            return new Response(Uint8Array.from([1, 2, 3, 4]), {
                status: options.headers?.range ? 206 : 200,
                headers: {
                    'content-type': 'audio/mpeg',
                    'accept-ranges': 'bytes',
                    'content-range': 'bytes 0-3/4',
                    'content-length': '4'
                }
            });
        }
        if (url.endsWith('/covers/en_thorie.png')) {
            return new Response(Uint8Array.from([137, 80, 78, 71]), {
                headers: { 'content-type': 'image/png', 'content-length': '4' }
            });
        }
        return new Response(null, { status: 404 });
    };
    const config = createTestConfig({ kyros: { enabled: false } });
    const started = await startTestServer(createApp({ config, fetchImplementation }));
    baseUrl = started.baseUrl;
    server = started.server;
});

after(async () => stopTestServer(server));

test('le catalogue public Harmonix est disponible sans session et sans identifiants privés', async () => {
    const response = await fetch(`${baseUrl}/api/harmonix/tracks`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload.data.tracks, [{
        id: 'en_thorie',
        title: 'En Théorie',
        artist: 'Mathéo',
        album: 'AUTOPILOT',
        duration: 204.768,
        coverUrl: '/api/harmonix/covers/en_thorie.png',
        streamUrl: '/api/harmonix/tracks/en_thorie/stream'
    }]);
});

test('le proxy audio transmet les requêtes Range nécessaires au lecteur', async () => {
    const response = await fetch(`${baseUrl}/api/harmonix/tracks/en_thorie/stream`, {
        headers: { range: 'bytes=0-3' }
    });

    assert.equal(response.status, 206);
    assert.equal(response.headers.get('content-type'), 'audio/mpeg');
    assert.equal(response.headers.get('accept-ranges'), 'bytes');
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [1, 2, 3, 4]);
    const upstream = requests.find((request) => request.url.endsWith('/api/sonora/stream/en_thorie'));
    assert.equal(upstream.options.headers.range, 'bytes=0-3');
});

test('le proxy de cover reste limité aux noms de fichiers image', async () => {
    const response = await fetch(`${baseUrl}/api/harmonix/covers/en_thorie.png`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');

    const invalid = await fetch(`${baseUrl}/api/harmonix/covers/not-an-image.txt`);
    assert.equal(invalid.status, 400);
    const payload = await invalid.json();
    assert.equal(payload.code, 'HARMONIX_COVER_INVALID');
});

test('un identifiant audio invalide est refusé avant tout appel externe', async () => {
    const before = requests.length;
    const response = await fetch(`${baseUrl}/api/harmonix/tracks/bad%20id/stream`);
    assert.equal(response.status, 400);
    assert.equal(requests.length, before);
});
