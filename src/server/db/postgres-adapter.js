// src/server/db/postgres-adapter.js
// Adaptateur PostgreSQL (pg) exposant le même contrat asynchrone que SQLite :
// query/exec/transaction/close/ping. Un pool de connexions supporte les
// requêtes concurrentes ; chaque transaction isole son propre client.
// Aucun repli silencieux : toute erreur de connexion remonte à l'appelant.
const { AsyncLocalStorage } = require('node:async_hooks');
const pg = require('pg');
const logger = require('../utils/logger');

const transactionContext = new AsyncLocalStorage();

function bindArguments(params) {
    if (params === undefined || params === null) return [];
    if (Array.isArray(params)) return params.map((value) => (value === undefined ? null : value));
    if (typeof params === 'object') {
        throw new Error('Les requêtes PostgreSQL attendent des paramètres positionnels ($1, $2, …).');
    }
    return [params === undefined ? null : params];
}

function createPostgresDatabase({ connection = {}, poolOptions = {} } = {}) {
    const types = {
        getTypeParser(oid, format) {
            // BIGINT (COUNT/SUM) : renvoyé en chaîne par défaut, converti en nombre.
            if (oid === 20 && format !== 'binary') {
                return (value) => (value === null ? null : Number(value));
            }
            return pg.types.getTypeParser(oid, format);
        }
    };

    const pool = new pg.Pool({ ...connection, ...poolOptions, types });
    pool.on('error', (error) => {
        logger.error('pg_pool_error', { message: error.message });
    });

    async function runQuery(client, sql, params) {
        const result = await client.query(sql, bindArguments(params));
        return { rows: result.rows, rowCount: result.rowCount ?? result.rows.length };
    }

    async function query(sql, params) {
        const active = transactionContext.getStore();
        if (active) return runQuery(active.client, sql, params);
        return runQuery(pool, sql, params);
    }

    async function exec(sql, params) {
        if (params !== undefined && params !== null) {
            throw new Error('postgres-adapter.exec ne prend pas de paramètres.');
        }
        const active = transactionContext.getStore();
        if (active) {
            await active.client.query(sql);
            return;
        }
        await pool.query(sql);
    }

    async function withClient(fn) {
        const client = await pool.connect();
        try {
            return await fn(client);
        } finally {
            client.release();
        }
    }

    async function transaction(fn) {
        const active = transactionContext.getStore();
        if (active) {
            const savepoint = `luma_sp_${active.depth}`;
            await active.client.query(`SAVEPOINT ${savepoint}`);
            active.depth += 1;
            try {
                const result = await fn({ query: (sql, params) => runQuery(active.client, sql, params), exec: (sql) => active.client.query(sql).then(() => undefined) });
                await active.client.query(`RELEASE SAVEPOINT ${savepoint}`);
                return result;
            } catch (error) {
                await active.client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`).catch(() => undefined);
                await active.client.query(`RELEASE SAVEPOINT ${savepoint}`).catch(() => undefined);
                throw error;
            }
        }

        return withClient(async (client) => {
            await client.query('BEGIN');
            const context = {
                depth: 0,
                client,
                api: {
                    query: (sql, params) => runQuery(client, sql, params),
                    exec: (sql) => client.query(sql).then(() => undefined)
                }
            };
            try {
                const result = await transactionContext.run(context, () => fn(context.api));
                await client.query('COMMIT');
                return result;
            } catch (error) {
                await client.query('ROLLBACK').catch(() => undefined);
                throw error;
            }
        });
    }

    return {
        provider: 'postgresql',
        pool,
        query,
        exec,
        transaction,
        async ping() {
            await pool.query('SELECT 1 AS ok');
            return true;
        },
        async close() {
            await pool.end();
        }
    };
}

module.exports = { createPostgresDatabase };
