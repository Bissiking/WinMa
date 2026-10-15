// src/server/server.js
const { createApp } = require('./app');
const { loadConfig } = require('./config/env');
const logger = require('./utils/logger');

async function main() {
    const config = loadConfig();
    const app = await createApp({ config });

    const server = app.listen(config.port, config.host, () => {
        logger.info('server_started', {
            host: config.host,
            port: config.port,
            kyrosConfigured: config.kyros.enabled,
            dbProvider: config.database.provider
        });
    });

    let closing = false;
    async function shutdown(signal) {
        if (closing) return;
        closing = true;
        logger.info('server_stopping', { signal });
        const forceExit = setTimeout(() => process.exit(1), 10000);
        forceExit.unref();
        await new Promise((resolve) => server.close(resolve));
        await app.locals.database?.close().catch((error) => {
            logger.error('database_close_failed', { message: error.message });
        });
        process.exit(0);
    }

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
    logger.error('server_start_failed', { message: error.message });
    process.exit(1);
});
