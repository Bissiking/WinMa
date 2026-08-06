// src/server/routes/api.js
const express = require('express');
const os = require('node:os');
const { sendSuccess } = require('../utils/api-response');

function readCpuTimes() {
    return os.cpus().reduce((summary, cpu) => {
        const total = Object.values(cpu.times).reduce((sum, value) => sum + value, 0);
        return { idle: summary.idle + cpu.times.idle, total: summary.total + total };
    }, { idle: 0, total: 0 });
}

let previousCpuTimes = readCpuTimes();

function systemMetrics(user) {
    const totalBytes = os.totalmem();
    const availableBytes = os.freemem();
    const logicalCores = Math.max(1, os.cpus().length);
    const cpuTimes = readCpuTimes();
    const idleDelta = cpuTimes.idle - previousCpuTimes.idle;
    const totalDelta = cpuTimes.total - previousCpuTimes.total;
    previousCpuTimes = cpuTimes;
    const cpuPercent = totalDelta > 0 ? (1 - idleDelta / totalDelta) * 100 : 0;
    return {
        timestamp: new Date().toISOString(),
        cpu: {
            percent: Math.min(100, Math.max(0, Math.round(cpuPercent * 10) / 10)),
            logicalCores,
            loadAverage: os.loadavg().map((value) => Math.round(value * 100) / 100)
        },
        memory: {
            totalBytes,
            usedBytes: totalBytes - availableBytes,
            availableBytes,
            percent: Math.round((totalBytes - availableBytes) / totalBytes * 1000) / 10
        },
        runtime: {
            uptimeSeconds: Math.round(process.uptime()),
            processMemoryBytes: process.memoryUsage().rss
        },
        user: { id: user.id, username: user.username, displayName: user.displayName }
    };
}

function createApiRoutes({ version, requireSession } = {}) {
    const router = express.Router();
    router.get('/api/health', (req, res) => sendSuccess(res, { status: 'ok', version }));
    if (requireSession) router.get('/api/system/metrics', requireSession, (req, res) => sendSuccess(res, systemMetrics(req.user)));
    return router;
}

module.exports = { createApiRoutes, systemMetrics };
