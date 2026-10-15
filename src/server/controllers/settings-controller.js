// src/server/controllers/settings-controller.js
const { sendSuccess } = require('../utils/api-response');

function createSettingsController(settingsService) {
    return {
        async show(req, res) {
            return sendSuccess(res, await settingsService.read(req.user.id));
        },
        async update(req, res) {
            return sendSuccess(
                res,
                await settingsService.update(req.user.id, req.body),
                'Paramètres enregistrés.'
            );
        }
    };
}

module.exports = { createSettingsController };
