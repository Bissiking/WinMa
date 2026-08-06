const { sendSuccess } = require('../utils/api-response');

function createBrainDumpController(service) {
    const accessToken = (req) => req.session?.kyros?.accessToken;
    return {
        notes: async (req, res) => sendSuccess(res, await service.listNotes(accessToken(req))),
        analyze: async (req, res) => sendSuccess(res, await service.analyze(accessToken(req), req.body)),
        create: async (req, res) => sendSuccess(res, await service.createNote(accessToken(req), req.body), 'La pensée est rangée.', 201),
        remove: async (req, res) => sendSuccess(res, await service.deleteNote(accessToken(req), req.params.id), 'La note a été supprimée.')
    };
}

module.exports = { createBrainDumpController };
