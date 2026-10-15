// scripts/migrate.js
// Applique les migrations SQL versionnées du fournisseur configuré
// (DB_PROVIDER=sqlite|postgresql). N'efface jamais de données existantes.
const { loadConfig } = require('../src/server/config/env');
const { createDatabase, runMigrations } = require('../src/server/db');

async function main() {
    const config = loadConfig();
    const database = await createDatabase(config.database);

    try {
        const result = await runMigrations(database, {
            migrationsDir: config.database.migrationsDir,
            provider: database.provider
        });

        console.log(JSON.stringify({
            provider: result.provider,
            applied: result.applied,
            alreadyApplied: result.alreadyApplied.length
        }, null, 2));
    } finally {
        await database.close().catch(() => undefined);
    }
}

main().catch((error) => {
    console.error(`Migration impossible : ${error.message}`);
    process.exit(1);
});
