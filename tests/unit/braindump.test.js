const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createBrainDumpService } = require('../../src/server/services/braindump-service');

const config = { baseUrl: 'https://braindump.test', timeoutMs: 1000 };

test('BrainDump relaie le bearer Kyros de Luma sur ses routes natives', async () => {
    const requests = [];
    const service = createBrainDumpService(config, async (url, options = {}) => {
        requests.push({ url, options });
        if (options.method === 'POST') return Response.json({ type: 'task', confidence: 91 });
        return Response.json([{ id: 1, content: 'Tester LUMA', type: 'task' }]);
    });

    const notes = await service.listNotes('kyros-luma-token');
    const analysis = await service.analyze('kyros-luma-token', { content: 'Tester LUMA demain' });

    assert.equal(notes[0].id, 1);
    assert.equal(analysis.type, 'task');
    assert.equal(requests[0].url, 'https://braindump.test/api/braindump/notes');
    assert.equal(requests[1].url, 'https://braindump.test/api/braindump/analyze');
    assert.equal(requests[0].options.headers.get('authorization'), 'Bearer kyros-luma-token');
    assert.deepEqual(JSON.parse(requests[1].options.body), { content: 'Tester LUMA demain' });
});

test('BrainDump valide le contenu et les identifiants avant le réseau', async () => {
    let calls = 0;
    const service = createBrainDumpService(config, async () => { calls += 1; return Response.json({}); });

    assert.throws(() => service.createNote('token', { content: ' ' }), (error) => error.code === 'BRAINDUMP_CONTENT_INVALID');
    assert.throws(() => service.deleteNote('token', '../1'), (error) => error.code === 'BRAINDUMP_NOTE_ID_INVALID');
    assert.equal(calls, 0);
});

test('BrainDump conserve les refus métier de l’API distante', async () => {
    const service = createBrainDumpService(config, async () => Response.json({ error: 'Scope Kyros manquant.' }, { status: 403 }));
    await assert.rejects(service.listNotes('token'), (error) => error.status === 403 && error.code === 'BRAINDUMP_REQUEST_FAILED');
});
