// src/server/repositories/index.js
// Sélection des repositories selon DB_PROVIDER (sqlite | postgresql).
// Chaque fournisseur expose strictement le même contrat asynchrone.
const { createSqliteSessionStoreRepository } = require('./sqlite-session-store-repository');
const { createSqliteSessionRepository } = require('./sqlite-session-repository');
const { createSqliteDocumentRepository } = require('./sqlite-document-repository');
const { createSqlitePreferencesRepository } = require('./sqlite-preferences-repository');
const { createSqliteWorkspaceRepository } = require('./sqlite-workspace-repository');
const { createPgSessionStoreRepository } = require('./pg-session-store-repository');
const { createPgSessionRepository } = require('./pg-session-repository');
const { createPgDocumentRepository } = require('./pg-document-repository');
const { createPgPreferencesRepository } = require('./pg-preferences-repository');
const { createPgWorkspaceRepository } = require('./pg-workspace-repository');

function createRepositories(database) {
    if (!database || typeof database.query !== 'function') {
        throw new Error('createRepositories attend une base de données ouverte.');
    }

    if (database.provider === 'sqlite') {
        return {
            provider: 'sqlite',
            sessionStore: createSqliteSessionStoreRepository(database),
            windowSessions: createSqliteSessionRepository(database),
            documents: createSqliteDocumentRepository(database),
            settings: createSqlitePreferencesRepository(database, 'user_settings'),
            account: createSqlitePreferencesRepository(database, 'account_preferences'),
            workspaces: createSqliteWorkspaceRepository(database)
        };
    }

    if (database.provider === 'postgresql') {
        return {
            provider: 'postgresql',
            sessionStore: createPgSessionStoreRepository(database),
            windowSessions: createPgSessionRepository(database),
            documents: createPgDocumentRepository(database),
            settings: createPgPreferencesRepository(database, 'user_settings'),
            account: createPgPreferencesRepository(database, 'account_preferences'),
            workspaces: createPgWorkspaceRepository(database)
        };
    }

    throw new Error(`Fournisseur de base inconnu : "${database.provider}" (attendu : sqlite ou postgresql).`);
}

module.exports = { createRepositories };
