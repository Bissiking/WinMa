const express = require('express');
const multer = require('multer');
const { asyncHandler } = require('../utils/async-handler');
const { HttpError } = require('../utils/http-error');

function createSonoraStudioRoutes(controller, requireSession, requireSameOrigin) {
    const router = express.Router();
    const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 100 * 1024 * 1024, files: 1 }
    });
    const write = [requireSameOrigin, requireSession];
    const requireAudio = (req, res, next) => req.file
        ? next()
        : next(new HttpError(400, 'SONORA_FILE_REQUIRED', 'Sélectionnez un fichier audio.'));

    router.get('/api/sonora-studio/status', requireSession, asyncHandler(controller.status));
    router.get('/api/sonora-studio/me', requireSession, asyncHandler(controller.identity));
    router.get('/api/sonora-studio/tracks', requireSession, asyncHandler(controller.tracks));
    router.patch('/api/sonora-studio/tracks/bulk-visibility', ...write, asyncHandler(controller.bulkTrackVisibility));
    router.patch('/api/sonora-studio/tracks/:id', ...write, asyncHandler(controller.updateTrack));
    router.delete('/api/sonora-studio/tracks/:id', ...write, asyncHandler(controller.deleteTrack));
    router.post('/api/sonora-studio/upload', ...write, upload.single('file'), requireAudio, asyncHandler(controller.uploadTrack));
    router.get('/api/sonora-studio/albums', requireSession, asyncHandler(controller.albums));
    router.post('/api/sonora-studio/albums', ...write, asyncHandler(controller.createAlbum));
    router.patch('/api/sonora-studio/albums/:id', ...write, asyncHandler(controller.updateAlbum));
    router.delete('/api/sonora-studio/albums/:id', ...write, asyncHandler(controller.deleteAlbum));
    router.get('/api/sonora-studio/playlists', requireSession, asyncHandler(controller.playlists));
    router.post('/api/sonora-studio/playlists', ...write, asyncHandler(controller.createPlaylist));
    router.patch('/api/sonora-studio/playlists/:id', ...write, asyncHandler(controller.updatePlaylist));
    router.delete('/api/sonora-studio/playlists/:id', ...write, asyncHandler(controller.deletePlaylist));
    return router;
}

module.exports = { createSonoraStudioRoutes };
