// src/server/utils/logger.js
const REDACTED_KEYS = /authorization|cookie|password|secret|token/i;

function sanitize(value) {
    if (!value || typeof value !== 'object') {
        return value;
    }

    return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
            key,
            REDACTED_KEYS.test(key) ? '[REDACTED]' : sanitize(item)
        ])
    );
}

function write(level, message, metadata = {}) {
    const entry = {
        time: new Date().toISOString(),
        level,
        message,
        ...sanitize(metadata)
    };

    const output = JSON.stringify(entry);

    if (level === 'error') {
        console.error(output);
    } else {
        console.log(output);
    }
}

module.exports = {
    info(message, metadata) {
        write('info', message, metadata);
    },
    error(message, metadata) {
        write('error', message, metadata);
    }
};
