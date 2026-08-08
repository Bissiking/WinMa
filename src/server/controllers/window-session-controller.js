const { sendSuccess } = require('../utils/api-response');

function createWindowSessionController(windowSessionService) {
    return {
        async show(req, res) {
            return sendSuccess(res, await windowSessionService.read(req.user.id));
        },
        async update(req, res) {
            return sendSuccess(
                res,
                await windowSessionService.update(req.user.id, req.body),
                'Session enregistrée.'
            );
        },
        async clear(req, res) {
            return sendSuccess(res, await windowSessionService.clear(req.user.id), 'Session effacée.');
        }
    };
}

module.exports = { createWindowSessionController };
