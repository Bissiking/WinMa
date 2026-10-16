const { sendSuccess } = require('../utils/api-response');

function createWorkspaceController(workspaceService) {
    return {
        async index(req, res) {
            return sendSuccess(res, await workspaceService.list(req.user.id));
        },
        async create(req, res) {
            return sendSuccess(res, await workspaceService.create(req.user.id, req.body), 'Espace de travail créé.');
        },
        async rename(req, res) {
            return sendSuccess(res, await workspaceService.rename(req.user.id, req.params.id, req.body), 'Espace renommé.');
        },
        async saveLayout(req, res) {
            return sendSuccess(res, await workspaceService.saveLayout(req.user.id, req.params.id, req.body), 'Disposition enregistrée dans l’espace.');
        },
        async activate(req, res) {
            return sendSuccess(res, await workspaceService.activate(req.user.id, req.params.id), 'Espace appliqué.');
        },
        async remove(req, res) {
            return sendSuccess(res, await workspaceService.remove(req.user.id, req.params.id), 'Espace supprimé.');
        }
    };
}

module.exports = { createWorkspaceController };
