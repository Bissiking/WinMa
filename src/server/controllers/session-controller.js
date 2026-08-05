// src/server/controllers/session-controller.js
const { sendSuccess } = require('../utils/api-response');

function createSessionController(sessionService, config) {
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

    return { show };
}

module.exports = { createSessionController };
