// tests/unit/build-version.test.js
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { after, test } = require('node:test');
const {
    createBuildVersionService,
    renderServiceWorker,
    VERSION_PLACEHOLDER
} = require('../../src/server/services/build-version-service');

const temporaryRoots = [];

function createProject() {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'luma-build-'));
    temporaryRoots.push(root);
    fs.mkdirSync(path.join(root, 'sources', 'assets'), { recursive: true });
    fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><title>Luma</title>');
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version: '3.2.0' }));
    fs.writeFileSync(path.join(root, 'sources', 'sw.js'), 'const RAW = "__LUMA_BUILD__";');
    fs.writeFileSync(path.join(root, 'sources', 'assets', 'app.js'), 'console.log("luma");');
    return root;
}

after(() => {
    for (const root of temporaryRoots) fs.rmSync(root, { recursive: true, force: true });
});

test('la version de build est une empreinte stable et reproductible', () => {
    const root = createProject();
    const first = createBuildVersionService({ projectRoot: root, refreshMs: 0 });
    const second = createBuildVersionService({ projectRoot: root, refreshMs: 0 });

    assert.match(first.get(), /^[0-9a-f]{16}$/);
    assert.equal(first.get(), second.get());
    assert.equal(first.get(), first.get());
});

test('la version de build change quand une ressource du shell change', () => {
    const root = createProject();
    const service = createBuildVersionService({ projectRoot: root, refreshMs: 0 });
    const before = service.get();

    fs.writeFileSync(path.join(root, 'sources', 'assets', 'app.js'), 'console.log("nouvelle version");');

    assert.notEqual(service.get(), before);
});

test('la version de build ignore les fichiers hors de la racine servie', () => {
    const root = createProject();
    const service = createBuildVersionService({ projectRoot: root, refreshMs: 0 });
    const before = service.get();

    fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
    fs.writeFileSync(path.join(root, 'docs', 'notes.md'), '# notes');

    assert.equal(service.get(), before);
});

test('la version est mise en cache puis rafraîchie après invalidation', () => {
    const root = createProject();
    const service = createBuildVersionService({ projectRoot: root, refreshMs: 60_000 });
    const before = service.get();

    fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><title>Luma OS</title>');
    assert.equal(service.get(), before, 'le cache court doit encore servir l’ancienne version');

    service.invalidate();
    assert.notEqual(service.get(), before);
});

test('le service worker reçoit la version de build à la place du marqueur', () => {
    const source = `const RAW_BUILD_VERSION = "${VERSION_PLACEHOLDER}";`;
    const rendered = renderServiceWorker(source, 'abc123def4567890');

    assert.equal(rendered, 'const RAW_BUILD_VERSION = "abc123def4567890";');
    assert.equal(renderServiceWorker(rendered, 'other'), rendered, 'un marqueur absent reste inchangé');
});

test('une racine de projet manquante est refusée', () => {
    assert.throws(() => createBuildVersionService({}), /racine du projet/i);
});
