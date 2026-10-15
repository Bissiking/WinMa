// tests/unit/security.test.js
const assert = require('node:assert/strict');
const { test } = require('node:test');
const { normalizeFrameOrigin } = require('../../src/server/config/security');

test('normalizeFrameOrigin accepte uniquement des origines https host[:port]', () => {
    assert.equal(normalizeFrameOrigin('https://demo.example'), 'https://demo.example');
    assert.equal(normalizeFrameOrigin('https://demo.example:8443'), 'https://demo.example:8443');
    assert.equal(normalizeFrameOrigin('  https://demo.example  '), 'https://demo.example');

    const rejected = [
        null,
        undefined,
        '',
        '   ',
        42,
        {},
        'http://demo.example',
        'ftp://demo.example',
        'javascript:alert(1)',
        'data:text/html,<h1>hi',
        'https://demo.example/chemin',
        'https://demo.example?a=1',
        'https://demo.example#hash',
        'https://user:pass@demo.example',
        'demo.example',
        'https://'
    ];
    for (const value of rejected) {
        assert.equal(normalizeFrameOrigin(value), null, `${String(value)} doit être rejeté`);
    }
});
