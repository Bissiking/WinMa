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
    router.get('/api/sonora-studio/albums/:id', requireSession, asyncHandler(controller.album));
    router.put('/api/sonora-studio/albums/:id/tracks', ...write, asyncHandler(controller.setAlbumTracks));
    router.patch('/api/sonora-studio/albums/:id', ...write, asyncHandler(controller.updateAlbum));
    router.delete('/api/sonora-studio/albums/:id', ...write, asyncHandler(controller.deleteAlbum));
    router.get('/api/sonora-studio/playlists', requireSession, asyncHandler(controller.playlists));
    router.post('/api/sonora-studio/playlists', ...write, asyncHandler(controller.createPlaylist));
    router.get('/api/sonora-studio/playlists/:id', requireSession, asyncHandler(controller.playlist));
    router.put('/api/sonora-studio/playlists/:id/tracks', ...write, asyncHandler(controller.setPlaylistTracks));
    router.patch('/api/sonora-studio/playlists/:id', ...write, asyncHandler(controller.updatePlaylist));
    router.delete('/api/sonora-studio/playlists/:id', ...write, asyncHandler(controller.deletePlaylist));
    router.get('/api/sonora-studio/access/roles', requireSession, asyncHandler(controller.roles));
    router.get('/api/sonora-studio/access/users/:userId/roles', requireSession, asyncHandler(controller.userRoles));
    router.put('/api/sonora-studio/access/users/:userId/roles', ...write, asyncHandler(controller.setUserRoles));
    return router;
}

module.exports = { createSonoraStudioRoutes };
