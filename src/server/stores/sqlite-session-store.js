// src/server/stores/sqlite-session-store.js
const session = require('express-session');
const { createSqliteSessionStoreRepository } = require('../repositories/sqlite-session-store-repository');

class SqliteSessionStore extends session.Store {
    constructor(repository) {
        super();
        this.repository = repository;
    }

    get(sid, callback) {
        try {
            const row = this.repository.find(sid);
            if (!row) return callback(null, null);
            if (row.expires && row.expires.getTime() <= Date.now()) {
                this.repository.remove(sid);
                return callback(null, null);
            }
            return callback(null, row.data);
        } catch (error) {
            return callback(error);
        }
    }

    set(sid, value, callback) {
        try {
            const expires = value?.cookie?.expires ? new Date(value.cookie.expires) : null;
            this.repository.upsert(sid, value, expires);
            return callback?.(null);
        } catch (error) {
            return callback?.(error);
        }
    }

    destroy(sid, callback) {
        try {
            this.repository.remove(sid);
            return callback?.(null);
        } catch (error) {
            return callback?.(error);
        }
    }

    touch(sid, value, callback) {
        return this.set(sid, value, callback);
    }

    prune() {
        this.repository.prune();
    }
}

function createSqliteSessionStore(databasePath) {
    return new SqliteSessionStore(createSqliteSessionStoreRepository(databasePath));
}

module.exports = { createSqliteSessionStore, SqliteSessionStore };
