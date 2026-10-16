// src/server/routes/api.js
const express = require('express');
const { sendSuccess } = require('../utils/api-response');
const { createSystemMetricsService } = require('../services/system-metrics-service');

// Instance partagée pour l'export `systemMetrics` (tests unitaires) ; les
// applications créent explicitement leur service via `createApiRoutes`.
let sharedMetricsService = null;

function getSharedMetricsService() {
    if (!sharedMetricsService) sharedMetricsService = createSystemMetricsService();
    return sharedMetricsService;
}

function systemMetrics(user, metricsService = getSharedMetricsService()) {
    const snapshot = metricsService.snapshot();
    return {
        ...snapshot,
        user: { id: user.id, username: user.username, displayName: user.displayName, avatarUrl: user.avatarUrl || null }
    };
}

const BUILD_EVENT_POLL_MS = 2000;
const BUILD_EVENT_KEEPALIVE_MS = 25000;

// Flux d'événements de build : dès qu'un déploiement change l'empreinte des
// ressources (git pull, rebuild), chaque onglet ouvert est prévenu et peut
// demander une vérification de mise à jour sans rechargement de la page.
function createBuildEventStream({ req, res, buildVersionService }) {
    // Une requête SSE reste ouverte indéfiniment : sans cela, Node détruit la
    // socket à échéance de `requestTimeout` (5 min par défaut) et le navigateur
    // affiche ERR_CONNECTION_RESET. keep-alive + no-delay gardent le flux vivant
    // et les événements immédiats.
    req.setTimeout(0);
    req.socket?.setKeepAlive(true);
    req.socket?.setNoDelay(true);

    res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, no-transform, must-revalidate',
        Connection: 'keep-alive',
        Pragma: 'no-cache',
        'X-Accel-Buffering': 'no'
    });
    res.write('retry: 5000\n\n');

    let lastBuild = null;
    const publish = () => {
        if (res.writableEnded || res.destroyed) { stop(); return; }
        const build = buildVersionService.get();
        if (build === lastBuild) return;
        lastBuild = build;
        res.write(`event: build\ndata: ${JSON.stringify({ build })}\n\n`);
    };

    publish();
    const pollTimer = setInterval(publish, BUILD_EVENT_POLL_MS);
    const keepAliveTimer = setInterval(() => {
        if (res.writableEnded || res.destroyed) { stop(); return; }
        res.write(': keep-alive\n\n');
    }, BUILD_EVENT_KEEPALIVE_MS);
    function stop() {
        clearInterval(pollTimer);
        clearInterval(keepAliveTimer);
    }
    res.on('close', stop);
    res.on('error', stop);
}

function createApiRoutes({ version, requireSession, networkService, buildVersionService, metricsService } = {}) {
    const activeMetricsService = metricsService || getSharedMetricsService();
    const router = express.Router();
    router.get('/api/health', (req, res) => sendSuccess(res, {
        status: 'ok',
        version,
        build: buildVersionService ? buildVersionService.get() : null
    }));
    if (buildVersionService) {
        router.get('/api/system/build-events', (req, res) => createBuildEventStream({ req, res, buildVersionService }));
    }
    if (requireSession) {
        router.get('/api/system/metrics', requireSession, (req, res) => sendSuccess(res, systemMetrics(req.user, activeMetricsService)));
    }
    if (requireSession && networkService) {
        router.get('/api/system/network', requireSession, async (req, res) => sendSuccess(res, await networkService.snapshot(req)));
    }
    return router;
}

module.exports = { createApiRoutes, systemMetrics };
