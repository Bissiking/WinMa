// src/server/server.js
const { createApp } = require('./app');
const { loadConfig } = require('./config/env');
const logger = require('./utils/logger');

const config = loadConfig();
const app = createApp({ config });

app.listen(config.port, config.host, () => {
    logger.info('server_started', {
        host: config.host,
        port: config.port,
        kyrosConfigured: config.kyros.enabled
    });
});
