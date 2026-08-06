const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { afterEach, test } = require('node:test');
const { createSqliteDocumentRepository } = require('../../src/server/repositories/sqlite-document-repository');
const { createDocumentService, QUOTA_BYTES } = require('../../src/server/services/document-service');

const temporaryDirectories = [];

async function createService() {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'luma-documents-test-'));
    temporaryDirectories.push(directory);
    const repository = createSqliteDocumentRepository(path.join(directory, 'documents.sqlite'));
    return createDocumentService({ repository, storageRoot: path.join(directory, 'storage') });
}

afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map((directory) => fs.rm(directory, { recursive: true, force: true })));
});

test('un utilisateur peut créer une arborescence isolée', async () => {
    const service = await createService();
    const folder = await service.createFolder('usr_one', { name: 'Projets' });
    await service.createFolder('usr_one', { name: 'Luma', parentId: folder.id });

    assert.equal((await service.list('usr_one')).items[0].name, 'Projets');
    assert.equal((await service.list('usr_one', { parentId: folder.id })).items[0].name, 'Luma');
    assert.equal((await service.list('usr_two')).items.length, 0);
});

test('un fichier utilise le quota et traverse la Corbeille', async () => {
    const service = await createService();
    const directory = temporaryDirectories.at(-1);
    const temporaryFile = path.join(directory, 'upload.tmp');
    await fs.writeFile(temporaryFile, 'Luma document');
    const item = await service.upload('usr_one', {}, {
        path: temporaryFile,
        originalname: 'vision.txt',
        mimetype: 'text/plain',
        size: 13
    });

    let listing = await service.list('usr_one');
    assert.equal(listing.storage.quotaBytes, QUOTA_BYTES);
    assert.equal(listing.storage.usedBytes, 13);
    assert.equal(listing.items[0].name, 'vision.txt');

    await service.trash('usr_one', [item.id]);
    listing = await service.list('usr_one', { trash: true });
    assert.equal(listing.items.length, 1);
    assert.equal(listing.storage.usedBytes, 13);

    await service.restore('usr_one', [item.id]);
    assert.equal((await service.list('usr_one')).items.length, 1);

    await service.trash('usr_one', [item.id]);
    await service.permanentlyDelete('usr_one', [item.id]);
    assert.equal((await service.list('usr_one', { trash: true })).storage.usedBytes, 0);
});

test('un dossier ne peut pas être déplacé dans son descendant', async () => {
    const service = await createService();
    const parent = await service.createFolder('usr_one', { name: 'Parent' });
    const child = await service.createFolder('usr_one', { name: 'Enfant', parentId: parent.id });

    await assert.rejects(
        service.update('usr_one', parent.id, { parentId: child.id }),
        (error) => error.code === 'DOCUMENT_MOVE_CYCLE'
    );
});

test('vider la Corbeille supprime tous les groupes appartenant à l’utilisateur', async () => {
    const service = await createService();
    const first = await service.createFolder('usr_one', { name: 'Premier' });
    const second = await service.createFolder('usr_one', { name: 'Second' });
    await service.trash('usr_one', [first.id, second.id]);

    assert.equal((await service.emptyTrash('usr_one')).count, 2);
    assert.equal((await service.list('usr_one', { trash: true })).items.length, 0);
});

test('un document Markdown peut être créé, relu et enregistré', async () => {
    const service = await createService();
    const item = await service.createText('usr_one', { name: 'journal.md', content: '# Bonjour' });

    assert.equal(item.mimeType, 'text/markdown');
    assert.equal(item.size, 9);
    assert.equal((await service.readText('usr_one', item.id)).content, '# Bonjour');

    const updated = await service.saveText('usr_one', item.id, { content: '# Bonjour Luma' });
    assert.equal(updated.size, 14);
    assert.equal((await service.readText('usr_one', item.id)).content, '# Bonjour Luma');
});

test('le Bloc-notes refuse de modifier un fichier binaire', async () => {
    const service = await createService();
    const directory = temporaryDirectories.at(-1);
    const temporaryFile = path.join(directory, 'image.tmp');
    await fs.writeFile(temporaryFile, Buffer.from([0, 1, 2]));
    const item = await service.upload('usr_one', {}, {
        path: temporaryFile,
        originalname: 'image.png',
        mimetype: 'image/png',
        size: 3
    });

    await assert.rejects(
        service.readText('usr_one', item.id),
        (error) => error.code === 'DOCUMENT_NOT_TEXT'
    );
});
