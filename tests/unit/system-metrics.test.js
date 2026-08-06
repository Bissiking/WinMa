const assert = require('node:assert/strict');
const { test } = require('node:test');
const { systemMetrics } = require('../../src/server/routes/api');

test('les métriques système exposent CPU, mémoire et utilisateur actif', () => {
    const metrics = systemMetrics({ id: 'usr_one', username: 'matheo', displayName: 'Mathéo' });

    assert.ok(metrics.cpu.logicalCores >= 1);
    assert.ok(metrics.cpu.percent >= 0 && metrics.cpu.percent <= 100);
    assert.ok(metrics.memory.totalBytes > 0);
    assert.ok(metrics.memory.usedBytes >= 0);
    assert.equal(metrics.user.username, 'matheo');
    assert.equal(metrics.user.displayName, 'Mathéo');
});
