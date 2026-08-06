const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createSonoraStudioService } = require('../../src/server/services/sonora-studio-service');

const config = { baseUrl: 'https://sonora.test', timeoutMs: 1000 };

test('Sonora Studio transmet le token Kyros utilisateur sans échange de clé', async () => {
    const requests = [];
    const fetchImplementation = async (url, options = {}) => {
        requests.push({ url, options });
        if (url.includes('/api/studio/music?')) return Response.json({ items: [{ id: 'track-1', title: 'Lueur', visibility: 'private' }] });
        if (url.endsWith('/api/albums')) return Response.json([]);
        return new Response(null, { status: 404 });
    };
    const service = createSonoraStudioService(config, fetchImplementation);

    await service.listTracks('kyros-user-token', { q: 'Lueur', page: 1, limit: 25, visibility: 'private' });
    await service.listAlbums('kyros-user-token');

    assert.equal(requests.length, 2);
    assert.equal(requests[0].options.headers.get('authorization'), 'Bearer kyros-user-token');
    assert.equal(requests[1].options.headers.get('authorization'), 'Bearer kyros-user-token');
    assert.equal(requests[0].options.headers.has('x-luma-key'), false);
    assert.equal(requests[0].url, 'https://sonora.test/api/studio/music?q=Lueur&page=1&limit=25&visibility=private');
});

test('Sonora Studio vérifie l’identité et publie une sélection avec le même bearer', async () => {
    const requests = [];
    const service = createSonoraStudioService(config, async (url, options = {}) => {
        requests.push({ url, options });
        if (url.endsWith('/api/auth/me')) return Response.json({ id: 'user_kyros_123', permissions: ['tracks:create', 'tracks:update'] });
        return Response.json({ success: true, updated: 2, visibility: 'public' });
    });

    const identity = await service.getIdentity('kyros-user-token');
    const result = await service.bulkTrackVisibility('kyros-user-token', { ids: ['track-1', 'track-2'], visibility: 'public' });

    assert.equal(identity.id, 'user_kyros_123');
    assert.equal(result.updated, 2);
    assert.equal(requests[1].url, 'https://sonora.test/api/studio/music/bulk-visibility');
    assert.equal(requests[1].options.method, 'PATCH');
    assert.equal(requests[1].options.headers.get('authorization'), 'Bearer kyros-user-token');
    assert.deepEqual(JSON.parse(requests[1].options.body), { ids: ['track-1', 'track-2'], visibility: 'public' });
});

test('Sonora Studio relaie un refus Kyros de Sonora sans fabriquer de nouveau token', async () => {
    let calls = 0;
    const service = createSonoraStudioService(config, async () => {
        calls += 1;
        return Response.json({ message: 'Rôle Sonora requis.' }, { status: 403 });
    });

    await assert.rejects(service.listTracks('kyros-user-token'), (error) => error.status === 403 && error.code === 'SONORA_REQUEST_FAILED');
    assert.equal(calls, 1);
});

test('Sonora Studio refuse les identifiants de chemin avant tout appel réseau', () => {
    let calls = 0;
    const service = createSonoraStudioService(config, async () => { calls += 1; return Response.json({}); });

    assert.throws(() => service.deleteTrack('kyros-user-token', '../secret'), (error) => error.code === 'SONORA_ID_INVALID');
    assert.equal(calls, 0);
});

test('Sonora Studio exige un token issu de la session Kyros', async () => {
    const service = createSonoraStudioService(config, async () => {
        throw new Error('aucun appel attendu');
    });

    assert.deepEqual(service.status('kyros-user-token'), { authenticated: true, apiVersion: '5.0.0', authentication: 'kyros' });
    await assert.rejects(service.listAlbums(null), (error) => error.code === 'KYROS_TOKEN_REQUIRED' && error.status === 401);
});

test('Sonora Studio relaie l’ordre des pistes d’un album et d’une playlist', async () => {
    const requests = [];
    const service = createSonoraStudioService(config, async (url, options = {}) => {
        requests.push({ url, options });
        return Response.json({ success: true, track_ids: ['track-2', 'track-1'] });
    });

    await service.setAlbumTracks('kyros-user-token', 'album-1', { track_ids: ['track-2', 'track-1'] });
    await service.setPlaylistTracks('kyros-user-token', 'playlist-1', { track_ids: ['track-2', 'track-1'] });

    assert.deepEqual(requests.map(({ url }) => url), [
        'https://sonora.test/api/albums/album-1/tracks',
        'https://sonora.test/api/playlists/playlist-1/tracks'
    ]);
    assert.ok(requests.every(({ options }) => options.method === 'PUT'));
    assert.deepEqual(JSON.parse(requests[0].options.body), { track_ids: ['track-2', 'track-1'] });
});

test('Sonora Studio permet de lire et d’affecter les rôles d’un utilisateur Kyros', async () => {
    const requests = [];
    const service = createSonoraStudioService(config, async (url, options = {}) => {
        requests.push({ url, options });
        return Response.json([]);
    });

    await service.listRoles('kyros-user-token');
    await service.getUserRoles('kyros-user-token', 'user@example.test');
    await service.setUserRoles('kyros-user-token', 'user@example.test', { role_ids: ['editor'] });

    assert.equal(requests[0].url, 'https://sonora.test/api/access/roles');
    assert.equal(requests[1].url, 'https://sonora.test/api/access/users/user%40example.test/roles');
    assert.equal(requests[2].options.method, 'PUT');
    assert.deepEqual(JSON.parse(requests[2].options.body), { role_ids: ['editor'] });
});

test('Sonora Studio refuse un identifiant utilisateur contenant un séparateur de chemin', () => {
    const service = createSonoraStudioService(config, async () => Response.json({}));
    assert.throws(() => service.getUserRoles('kyros-user-token', '../admin'), (error) => error.code === 'SONORA_USER_ID_INVALID');
});
