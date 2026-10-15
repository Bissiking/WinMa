// src/server/db/migrator.js
// Migrations SQL versionnées, communes aux deux fournisseurs.
// Convention de nommage : NNNN_nom.sqlite.sql / NNNN_nom.postgresql.sql
// Chaque fichier est appliqué une seule fois, dans une transaction, et
// enregistré dans la table schema_migrations.
const fs = require('node:fs/promises');
const path = require('node:path');

const FILE_PATTERN = /^(\d{4})_([a-z0-9_-]+)\.(sqlite|postgresql)\.sql$/i;
const PROVIDERS = new Set(['sqlite', 'postgresql']);

function appliedTableSql() {
    return `
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TEXT NOT NULL
        );
    `;
}

async function loadMigrations(migrationsDir, provider) {
    if (!PROVIDERS.has(provider)) {
        throw new Error(`Fournisseur de migrations inconnu : ${provider}`);
    }

    let entries;
    try {
        entries = await fs.readdir(migrationsDir);
    } catch (error) {
        if (error.code === 'ENOENT') {
            throw new Error(`Répertoire de migrations introuvable : ${migrationsDir}`);
        }
        throw error;
    }

    const migrations = [];
    const seen = new Set();

    for (const entry of entries.sort()) {
        const match = FILE_PATTERN.exec(entry);
        if (!match) continue;
        const [, version, name, fileProvider] = match;
        if (fileProvider.toLowerCase() !== provider) continue;
        if (seen.has(version)) {
            throw new Error(`Migration en double pour la version ${version} (${provider}).`);
        }
        seen.add(version);
        migrations.push({ version, name, filePath: path.join(migrationsDir, entry), fileName: entry });
    }

    return migrations.sort((a, b) => a.version.localeCompare(b.version));
}

async function appliedVersions(database) {
    const result = await database.query('SELECT version FROM schema_migrations');
    return new Set(result.rows.map((row) => row.version));
}

async function insertApplied(database, migration, appliedAt) {
    if (database.provider === 'postgresql') {
        await database.query(
            'INSERT INTO schema_migrations (version, name, applied_at) VALUES ($1, $2, $3)',
            [migration.version, migration.name, appliedAt]
        );
        return;
    }
    await database.query(
        'INSERT INTO schema_migrations (version, name, applied_at) VALUES (@version, @name, @appliedAt)',
        { version: migration.version, name: migration.name, appliedAt }
    );
}

async function runMigrations(database, { migrationsDir, provider = database.provider } = {}) {
    if (!migrationsDir) throw new Error('Le répertoire des migrations est requis.');
    if (provider !== database.provider) {
        throw new Error(
            `Migration refusée : le schéma cible (${provider}) ne correspond pas au fournisseur actif (${database.provider}).`
        );
    }

    await database.exec(appliedTableSql());

    const [migrations, applied] = await Promise.all([
        loadMigrations(migrationsDir, provider),
        appliedVersions(database)
    ]);

    const appliedNow = [];
    const skipped = [];

    for (const migration of migrations) {
        if (applied.has(migration.version)) {
            skipped.push(migration.fileName);
            continue;
        }
        const sql = await fs.readFile(migration.filePath, 'utf8');
        await database.transaction(async (trx) => {
            await trx.exec(sql);
            const appliedAt = new Date().toISOString();
            if (provider === 'postgresql') {
                await trx.query(
                    'INSERT INTO schema_migrations (version, name, applied_at) VALUES ($1, $2, $3)',
                    [migration.version, migration.name, appliedAt]
                );
            } else {
                await trx.query(
                    'INSERT INTO schema_migrations (version, name, applied_at) VALUES (@version, @name, @appliedAt)',
                    { version: migration.version, name: migration.name, appliedAt }
                );
            }
        });
        appliedNow.push(migration.fileName);
    }

    return { provider, applied: appliedNow, alreadyApplied: skipped };
}

module.exports = { runMigrations, loadMigrations, appliedTableSql };
