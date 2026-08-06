const express = require('express');
const { asyncHandler } = require('../utils/async-handler');

function createHarmonixRoutes(harmonixController) {
    const router = express.Router();
    router.get('/api/harmonix/tracks', asyncHandler(harmonixController.listTracks));
    router.get('/api/harmonix/tracks/:trackId/stream', asyncHandler(harmonixController.streamTrack));
    router.get('/api/harmonix/covers/:coverName', asyncHandler(harmonixController.showCover));
    return router;
}

module.exports = { createHarmonixRoutes };
