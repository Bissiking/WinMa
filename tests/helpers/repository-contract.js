// tests/helpers/repository-contract.js
// Contrat commun des repositories : les mêmes assertions s'exécutent contre
// SQLite (toujours) et PostgreSQL (si TEST_DATABASE_URL est disponible).
// testDb(name, fn) est fourni par le fichier de test (skip si indisponible).
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createDocumentService, QUOTA_BYTES } = require('../../src/server/services/document-service');
const { createWindowSessionService } = require('../../src/server/services/window-session-service');
const { createSessionStore } = require('../../src/server/stores/session-store');
const { createSettingsService } = require('../../src/server/services/settings-service');
const { createAccountService } = require('../../src/server/services/account-service');

function toPromise(method, ...args) {
    return new Promise((resolve, reject) => {
        method(...args, (error, value) => (error ? reject(error) : resolve(value)));
    });
}

function defineRepositoryContractSuite({ testDb, createContext }) {
    async function context() {
        return createContext();
    }

    testDb('contrat fenêtres : isolation et écrasement par utilisateur', async (t) => {
        const { repositories } = await context(t);
        const service = createWindowSessionService(repositories.windowSessions);

        await service.update('usr_one', { windows: [{ appId: 'terminal' }] });
        await service.update('usr_one', { windows: [{ appId: 'calculator' }, { appId: 'calendar' }] });

        const saved = await service.read('usr_one');
        assert.equal(saved.windows.length, 2);
        assert.equal(saved.windows[0].appId, 'calculator');
        assert.deepEqual(await service.read('usr_two'), { windows: [], updatedAt: null });

        await service.clear('usr_one');
        assert.deepEqual(await service.read('usr_one'), { windows: [], updatedAt: null });
    });

    testDb('contrat sessions : cycle complet du magasin express-session', async (t) => {
        const { repositories } = await context(t);
        const store = createSessionStore(repositories.sessionStore);

        const future = { user: { id: 'usr_1', username: 'matheo' }, cookie: { expires: new Date(Date.now() + 60_000) } };
        await toPromise(store.set.bind(store), 'sid-1', future);
        const loaded = await toPromise(store.get.bind(store), 'sid-1');
        assert.equal(loaded.user.username, 'matheo');
        assert.equal(await toPromise(store.get.bind(store), 'missing'), null);

        await toPromise(store.set.bind(store), 'sid-old', {
            user: { id: 'usr_old' },
            cookie: { expires: new Date(Date.now() - 1000) }
        });
        assert.equal(await toPromise(store.get.bind(store), 'sid-old'), null);

        await store.prune();
        assert.notEqual(await toPromise(store.get.bind(store), 'sid-1'), null);

        await toPromise(store.destroy.bind(store), 'sid-1');
        assert.equal(await toPromise(store.get.bind(store), 'sid-1'), null);
    });

    testDb('contrat préférences : paramètres et compte isolés par sujet Kyros', async (t) => {
        const { repositories, directory } = await context(t);
        const settings = createSettingsService({
            repository: repositories.settings,
            legacyDirectory: path.join(directory, 'settings')
        });
        const account = createAccountService({
            repository: repositories.account,
            legacyDirectory: path.join(directory, 'accounts')
        });

        await settings.update('usr_one', { theme: 'dark', accentColor: '#3366CC' });
        assert.equal((await settings.read('usr_one')).theme, 'dark');
        assert.equal((await settings.read('usr_two')).theme, 'luma');

        await account.update('usr_one', { preferredName: 'Mathéo', syncAppearance: false });
        assert.equal((await account.read('usr_one')).preferredName, 'Mathéo');
        assert.equal((await account.read('usr_one')).syncAppearance, false);
        assert.equal((await account.read('usr_two')).preferredName, '');

        await assert.rejects(
            settings.update('usr_one', { wallpaper: 'https://attacker.example/x.jpg' }),
            (error) => error.code === 'WALLPAPER_INVALID'
        );
        await assert.rejects(
            account.update('usr_one', { unknown: true }),
            (error) => error.code === 'ACCOUNT_INVALID'
        );
    });

    testDb('contrat documents : arborescence, corbeille, quota et statistiques', async (t) => {
        const { repositories, directory } = await context(t);
        const service = createDocumentService({
            repository: repositories.documents,
            storageRoot: path.join(directory, 'storage')
        });

        const uploadFixture = async (subject, name, mimetype, content) => {
            const file = path.join(directory, `${name}-${Math.random().toString(36).slice(2)}.tmp`);
            await fs.writeFile(file, content);
            return service.upload(subject, {}, {
                path: file, originalname: name, mimetype, size: Buffer.byteLength(content)
            });
        };

        const folder = await service.createFolder('usr_one', { name: 'Projets' });
        const child = await service.createFolder('usr_one', { name: 'Luma', parentId: folder.id });
        assert.equal((await service.list('usr_one')).items[0].name, 'Projets');
        assert.equal((await service.list('usr_one', { parentId: folder.id })).items[0].name, 'Luma');
        assert.equal((await service.list('usr_one', { parentId: folder.id })).breadcrumbs[0].id, folder.id);
        assert.equal((await service.list('usr_two')).items.length, 0);
        assert.equal((await service.listFolders('usr_one')).length, 3);

        // Conflit de nom insensible à la casse (COLLATE NOCASE / LOWER).
        await assert.rejects(
            service.createFolder('usr_one', { name: 'PROJETS' }),
            (error) => error.code === 'DOCUMENT_NAME_CONFLICT'
        );

        // Cycle de déplacement refusé.
        await assert.rejects(
            service.update('usr_one', folder.id, { parentId: child.id }),
            (error) => error.code === 'DOCUMENT_MOVE_CYCLE'
        );

        const image = await uploadFixture('usr_one', 'aurore.png', 'image/png', 'img');
        await uploadFixture('usr_one', 'note.md', 'text/markdown', '# note');
        await uploadFixture('usr_one', 'clip.mp4', 'video/mp4', 'vid');
        await uploadFixture('usr_two', 'secret.png', 'image/png', 'img');

        const listing = await service.list('usr_one');
        assert.equal(listing.items.length, 4);
        assert.equal(listing.storage.quotaBytes, QUOTA_BYTES);
        assert.equal(listing.storage.usedBytes, 12);

        const stats = await service.getStats('usr_one');
        assert.deepEqual(stats.categories, [
            { category: 'image', count: 1, bytes: 3 },
            { category: 'video', count: 1, bytes: 3 },
            { category: 'document', count: 1, bytes: 6 }
        ]);
        assert.deepEqual(stats.trash, { count: 0, bytes: 0 });
        assert.deepEqual((await service.getStats('usr_two')).categories, [
            { category: 'image', count: 1, bytes: 3 }
        ]);

        // Recherche avec caractères LIKE (échappement).
        const search = await service.list('usr_one', { search: 'note' });
        assert.equal(search.items.length, 1);
        assert.equal(search.items[0].name, 'note.md');

        // Corbeille : trash → restore → trash → suppression définitive.
        await service.trash('usr_one', [image.id, folder.id]);
        const trashed = await service.list('usr_one', { trash: true });
        assert.equal(trashed.items.length, 2);
        assert.equal((await service.list('usr_one')).items.length, 2);
        assert.deepEqual((await service.getStats('usr_one')).trash, { count: 1, bytes: 3 });

        await service.restore('usr_one', [folder.id]);
        assert.equal((await service.list('usr_one')).items.length, 3);

        assert.equal((await service.permanentlyDelete('usr_one', [image.id])).count, 1);
        assert.equal((await service.list('usr_one', { trash: true })).items.length, 0);

        // Filtres de type.
        assert.equal((await service.list('usr_one', { type: 'video' })).items.length, 1);
        assert.equal((await service.list('usr_one', { type: 'image' })).items.length, 0);
        await assert.rejects(
            service.list('usr_one', { type: 'musique' }),
            (error) => error.code === 'DOCUMENT_TYPE_INVALID'
        );

        // Isolation : l'autre utilisateur n'a jamais vu les éléments de usr_one.
        const other = await service.list('usr_two');
        assert.equal(other.items.length, 1);
        assert.equal(other.items[0].name, 'secret.png');
    });

    testDb('contrat documents : note texte créée, relue, enregistrée', async (t) => {
        const { repositories, directory } = await context(t);
        const service = createDocumentService({
            repository: repositories.documents,
            storageRoot: path.join(directory, 'storage')
        });

        const item = await service.createText('usr_one', { name: 'journal.md', content: '# Bonjour' });
        assert.equal(item.mimeType, 'text/markdown');
        assert.equal((await service.readText('usr_one', item.id)).content, '# Bonjour');

        const updated = await service.saveText('usr_one', item.id, { content: '# Bonjour Luma' });
        assert.equal(updated.size, 14);
        assert.equal((await service.readText('usr_one', item.id)).content, '# Bonjour Luma');
    });
}

module.exports = { defineRepositoryContractSuite };
