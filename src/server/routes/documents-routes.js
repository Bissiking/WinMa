const crypto = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const multer = require('multer');
const { asyncHandler } = require('../utils/async-handler');
const { HttpError } = require('../utils/http-error');

const upload = multer({
    storage: multer.diskStorage({
        destination: os.tmpdir(),
        filename(req, file, callback) { callback(null, `luma-upload-${crypto.randomUUID()}${path.extname(file.originalname).slice(0, 16)}`); }
    }),
    limits: { fileSize: 256 * 1024 * 1024, files: 1, fields: 8 }
});

function uploadOne(req, res, next) {
    upload.single('file')(req, res, (error) => {
        if (!error) return next();
        if (error.code === 'LIMIT_FILE_SIZE') return next(new HttpError(413, 'DOCUMENT_FILE_TOO_LARGE', 'Un fichier importé ne peut pas dépasser 256 Mo.'));
        return next(new HttpError(400, 'DOCUMENT_UPLOAD_INVALID', 'Le fichier envoyé est invalide.'));
    });
}

function createDocumentsRoutes(controller, requireSession, requireSameOrigin) {
    const router = express.Router();
    router.get('/api/documents', requireSession, asyncHandler(controller.index));
    router.get('/api/documents/folders', requireSession, asyncHandler(controller.folders));
    router.get('/api/documents/:id/download', requireSession, asyncHandler(controller.download));
    router.get('/api/documents/:id/preview', requireSession, asyncHandler(controller.preview));
    router.get('/api/documents/:id/content', requireSession, asyncHandler(controller.readText));
    router.post('/api/documents/folders', requireSameOrigin, requireSession, asyncHandler(controller.createFolder));
    router.post('/api/documents/upload', requireSameOrigin, requireSession, uploadOne, asyncHandler(controller.upload));
    router.post('/api/documents/text', requireSameOrigin, requireSession, asyncHandler(controller.createText));
    router.put('/api/documents/:id/content', requireSameOrigin, requireSession, asyncHandler(controller.saveText));
    router.patch('/api/documents/:id', requireSameOrigin, requireSession, asyncHandler(controller.update));
    router.post('/api/documents/actions/trash', requireSameOrigin, requireSession, asyncHandler(controller.trash));
    router.post('/api/documents/actions/restore', requireSameOrigin, requireSession, asyncHandler(controller.restore));
    router.post('/api/documents/actions/delete', requireSameOrigin, requireSession, asyncHandler(controller.permanentlyDelete));
    router.post('/api/documents/actions/empty-trash', requireSameOrigin, requireSession, asyncHandler(controller.emptyTrash));
    return router;
}

module.exports = { createDocumentsRoutes };
