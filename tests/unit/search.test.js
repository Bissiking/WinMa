// tests/unit/search.test.js
const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const searchUrl = pathToFileURL(path.join(__dirname, '..', '..', 'sources', 'assets', 'javascripts', 'luma-search.js')).href;

const sampleApps = [
    { id: 'calculator', name: 'Calculatrice', taskbarName: 'Calc.' },
    { id: 'documents', name: 'Documents', taskbarName: 'Docs' },
    { id: 'hidden', name: 'Application cachée', hidden: true },
    { id: 'broken', name: 'Bêta expérimental', incompatible: true },
    { id: 'store-app', name: 'Sonora Studio', storeManaged: true }
];

test('normalizeQuery plie la casse, retire les accents et les espaces', async () => {
    const { normalizeQuery } = await import(searchUrl);
    assert.equal(normalizeQuery('  Évènement '), 'evenement');
    assert.equal(normalizeQuery('CALCULATRICE'), 'calculatrice');
    assert.equal(normalizeQuery(null), '');
    assert.equal(normalizeQuery(undefined), '');
});

test('searchApps respecte l’éligibilité du registre et filtre sur nom et nom de tâche', async () => {
    const { searchApps } = await import(searchUrl);
    const ids = (query, installed = new Set(['store-app'])) => searchApps(sampleApps, { query, installed }).map((app) => app.id);

    assert.deepEqual(ids('calc'), ['calculator'], 'nom de tâche « Calc. »');
    assert.deepEqual(ids('docs'), ['documents']);
    assert.deepEqual(ids('calcul'), ['calculator'], 'recherche partielle insensible aux accents');
    assert.deepEqual(ids('cachée'), [], 'application cachée jamais exposée');
    assert.deepEqual(ids('bêta'), [], 'application incompatible jamais exposée');
    assert.deepEqual(ids('sonora', new Set()), [], 'application du store non installée');
    assert.deepEqual(ids('sonora'), ['store-app'], 'application du store installée');
    assert.equal(ids('').length, 3, 'seules les applications éligibles sont listées');
    assert.deepEqual(ids('introuvable'), []);
    assert.deepEqual(searchApps(null, { query: 'x' }), []);
});

test('searchEvents cherche dans les titres et se limite à cinq résultats', async () => {
    const { searchEvents } = await import(searchUrl);
    const events = [
        { id: 'e1', date: '2026-10-20', time: '09:00', title: "Réunion d'équipe" },
        { id: 'e2', date: '2026-10-21', title: 'Réception client' },
        ...Array.from({ length: 6 }, (_, index) => ({ id: `sum-${index}`, date: '2026-11-01', title: `Résumé ${index}` }))
    ];

    assert.deepEqual(searchEvents(events, 'reunion').map((event) => event.id), ['e1'], 'recherche sans accent ni casse');
    assert.deepEqual(searchEvents(events, 'RECEPTION').map((event) => event.id), ['e2']);
    assert.equal(searchEvents(events, 'ré').length, 5, 'limite de cinq résultats');
    assert.deepEqual(searchEvents(events, ''), [], 'aucun résultat sans requête');
    assert.deepEqual(searchEvents(null, 'réunion'), []);
});

test('searchSettings ouvre les vues par libellé ou mots-clés', async () => {
    const { searchSettings, SETTINGS_CATALOG } = await import(searchUrl);
    const views = (query) => searchSettings(query).map((entry) => entry.view);

    assert.ok(views('thème').includes('personalization'));
    assert.ok(views('corbeille').includes('storage'));
    assert.ok(views('fenêtres').includes('workspaces'));
    assert.ok(views('SAUVEGARDE').includes('backup'));
    assert.deepEqual(searchSettings(''), []);
    assert.ok(searchSettings('a').length <= 5, 'limite de cinq réglages');
    assert.ok(SETTINGS_CATALOG.every((entry) => entry.view && entry.label && entry.keywords));
});
