// src/server/db/sqlite-adapter.js
// Adaptateur SQLite (better-sqlite3) exposant le contrat asynchrone commun :
// query/exec/transaction/close/ping. Les transactions sont sérialisées par un
// verrou asynchrone afin qu'aucune requête extérieure ne s'invite entre BEGIN
// et COMMIT sur la connexion unique.
const { AsyncLocalStorage } = require('node:async_hooks');
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');

const transactionContext = new AsyncLocalStorage();

function sanitizeValue(value) {
    if (value === undefined) return null;
    if (typeof value === 'boolean') return value ? 1 : 0;
    if (value instanceof Date) return value.toISOString();
    return value;
}

function bindArguments(params) {
    if (params === undefined || params === null) return [];
    if (Array.isArray(params)) return params.map(sanitizeValue);
    if (typeof params === 'object') {
        const normalized = {};
        for (const [key, value] of Object.entries(params)) normalized[key] = sanitizeValue(value);
        return [normalized];
    }
    return [sanitizeValue(params)];
}

function createSqliteDatabase({ filePath }) {
    if (!filePath) throw new Error('Le chemin du fichier SQLite est requis.');

    fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
    const database = new Database(filePath);
    database.pragma('journal_mode = WAL');
    database.pragma('foreign_keys = ON');

    const statements = new Map();
    let queue = Promise.resolve();

    function withLock(task) {
        const execution = queue.then(task, task);
        queue = execution.then(() => undefined, () => undefined);
        return execution;
    }

    function prepare(sql) {
        let statement = statements.get(sql);
        if (!statement) {
            statement = database.prepare(sql);
            statements.set(sql, statement);
        }
        return statement;
    }

    function runStatement(sql, params) {
        const statement = prepare(sql);
        const args = bindArguments(params);
        if (statement.reader) {
            const rows = statement.all(...args);
            return { rows, rowCount: rows.length };
        }
        const info = statement.run(...args);
        return { rows: [], rowCount: info.changes, lastInsertRowid: info.lastInsertRowid };
    }

    async function query(sql, params) {
        const active = transactionContext.getStore();
        if (active) return runStatement(sql, params);
        return withLock(() => runStatement(sql, params));
    }

    async function exec(sql, params) {
        if (params !== undefined && params !== null) {
            throw new Error('sqlite-adapter.exec ne prend pas de paramètres.');
        }
        const active = transactionContext.getStore();
        if (active) {
            database.exec(sql);
            return;
        }
        return withLock(() => database.exec(sql));
    }

    async function transaction(fn) {
        const active = transactionContext.getStore();
        if (active) {
            const savepoint = `luma_sp_${active.depth}`;
            database.exec(`SAVEPOINT ${savepoint}`);
            active.depth += 1;
            try {
                const result = await fn(active.api);
                database.exec(`RELEASE ${savepoint}`);
                return result;
            } catch (error) {
                database.exec(`ROLLBACK TO ${savepoint}`);
                database.exec(`RELEASE ${savepoint}`);
                throw error;
            }
        }

        return withLock(async () => {
            database.exec('BEGIN');
            const context = {
                depth: 0,
                api: {
                    query: (sql, params) => Promise.resolve(runStatement(sql, params)),
                    exec: (sql) => {
                        database.exec(sql);
                        return Promise.resolve();
                    }
                }
            };
            try {
                const result = await transactionContext.run(context, () => fn(context.api));
                database.exec('COMMIT');
                return result;
            } catch (error) {
                try {
                    if (database.inTransaction) database.exec('ROLLBACK');
                } catch {
                    // La transaction peut déjà être annulée par SQLite.
                }
                throw error;
            }
        });
    }

    return {
        provider: 'sqlite',
        filePath,
        query,
        exec,
        transaction,
        async ping() {
            await query('SELECT 1 AS ok');
            return true;
        },
        async close() {
            statements.clear();
            database.close();
        }
    };
}

module.exports = { createSqliteDatabase };
