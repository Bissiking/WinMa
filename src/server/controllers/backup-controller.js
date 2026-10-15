// src/server/controllers/backup-controller.js
const { sendSuccess } = require('../utils/api-response');

function createBackupController(backupService) {
    return {
        async export(req, res) {
            return sendSuccess(res, await backupService.exportBackup(req.user));
        },
        async import(req, res) {
            return sendSuccess(res, await backupService.importBackup(req.user, req.body), 'Sauvegarde restaurée.');
        },
        async reset(req, res) {
            return sendSuccess(res, await backupService.reset(req.user, req.body?.targets), 'Données réinitialisées.');
        }
    };
}

module.exports = { createBackupController };
