// src/server/controllers/session-controller.js
const { Readable } = require('node:stream');
const { HttpError } = require('../utils/http-error');
const { sendSuccess } = require('../utils/api-response');

function createSessionController(sessionService, config, kyrosService) {
    async function show(req, res) {
        if (!req.session?.user) {
            return sendSuccess(res, {
                authenticated: false,
                user: null,
                authentication: { provider: 'kyros', available: config.kyros.enabled }
            });
        }

        const user = await sessionService.refreshIfNeeded(req);
        return sendSuccess(res, {
            authenticated: true,
            user,
            authentication: { provider: 'kyros', available: config.kyros.enabled }
        });
    }

    async function avatar(req, res) {
        const avatar = await kyrosService.fetchAvatar(req.user?.avatarUrl);

        if (!avatar || !avatar.body) {
            throw new HttpError(404, 'AVATAR_NOT_FOUND', "Aucun avatar n'est disponible pour ce compte.");
        }

        res.set('Cache-Control', 'private, max-age=3600');
        res.set('Content-Type', avatar.contentType);
        Readable.fromWeb(avatar.body).pipe(res);
    }

    return { show, avatar };
}

module.exports = { createSessionController };
