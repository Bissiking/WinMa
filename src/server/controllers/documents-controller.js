const { sendSuccess } = require('../utils/api-response');

function createDocumentsController(documentService) {
    return {
        async index(req, res) {
            return sendSuccess(res, await documentService.list(req.user.id, req.query));
        },
        async folders(req, res) {
            return sendSuccess(res, documentService.listFolders(req.user.id));
        },
        async createFolder(req, res) {
            return sendSuccess(res, await documentService.createFolder(req.user.id, req.body), 'Dossier créé.', 201);
        },
        async upload(req, res) {
            return sendSuccess(res, await documentService.upload(req.user.id, req.body, req.file), 'Fichier importé.', 201);
        },
        async update(req, res) {
            return sendSuccess(res, await documentService.update(req.user.id, req.params.id, req.body), 'Élément modifié.');
        },
        async trash(req, res) {
            return sendSuccess(res, await documentService.trash(req.user.id, req.body.ids), 'Élément déplacé dans la Corbeille.');
        },
        async restore(req, res) {
            return sendSuccess(res, await documentService.restore(req.user.id, req.body.ids), 'Élément restauré.');
        },
        async permanentlyDelete(req, res) {
            return sendSuccess(res, await documentService.permanentlyDelete(req.user.id, req.body.ids), 'Élément supprimé définitivement.');
        },
        async emptyTrash(req, res) {
            return sendSuccess(res, await documentService.emptyTrash(req.user.id), 'Corbeille vidée.');
        },
        async download(req, res) {
            const file = await documentService.download(req.user.id, req.params.id);
            return res.download(file.path, file.item.name);
        }
    };
}

module.exports = { createDocumentsController };
