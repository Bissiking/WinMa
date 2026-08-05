// tests/unit/env.test.js
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadConfig } = require('../../src/server/config/env');

test('Kyros reste désactivé lorsque les secrets Luma OS manquent', () => {
    const config = loadConfig({
        NODE_ENV: 'development',
        APP_BASE_URL: 'http://localhost:3000',
        LUMA_KYROS_BASE_URL: 'https://kyros.example.test'
    });

    assert.equal(config.kyros.enabled, false);
});

test('la production refuse une configuration sans secret de session', () => {
    assert.throws(
        () => loadConfig({ NODE_ENV: 'production', APP_BASE_URL: 'https://luma.example.test' }),
        /SESSION_SECRET/
    );
});
