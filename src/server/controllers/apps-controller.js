// src/server/controllers/apps-controller.js
const { sendSuccess } = require('../utils/api-response');

function createAppsController(appRegistryService) {
    return {
        async list(req, res) {
            return sendSuccess(res, await appRegistryService.list());
        },
        async show(req, res) {
            return sendSuccess(res, await appRegistryService.findById(req.params.appId));
        }
    };
}

module.exports = { createAppsController };
