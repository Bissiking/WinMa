// src/server/stores/session-store.js
// Magasin de session Express/Kyros indépendant du fournisseur : il s'appuie
// sur le repository de sessions (SQLite ou PostgreSQL) et conserve le contrat
// callback exigé par express-session. Les tokens Kyros restent côté serveur.
const session = require('express-session');

class DatabaseSessionStore extends session.Store {
    constructor(repository) {
        super();
        this.repository = repository;
    }

    get(sid, callback) {
        this.repository.find(sid)
            .then((row) => {
                if (!row) return callback(null, null);
                if (row.expires && row.expires.getTime() <= Date.now()) {
                    return this.repository.remove(sid).then(() => callback(null, null), callback);
                }
                return callback(null, row.data);
            })
            .catch(callback);
    }

    set(sid, value, callback) {
        const expires = value?.cookie?.expires ? new Date(value.cookie.expires) : null;
        this.repository.upsert(sid, value, expires)
            .then(() => callback?.(null), (error) => callback?.(error));
    }

    destroy(sid, callback) {
        this.repository.remove(sid)
            .then(() => callback?.(null), (error) => callback?.(error));
    }

    touch(sid, value, callback) {
        return this.set(sid, value, callback);
    }

    async prune() {
        await this.repository.prune();
    }
}

function createSessionStore(repository) {
    return new DatabaseSessionStore(repository);
}

module.exports = { createSessionStore, DatabaseSessionStore };
