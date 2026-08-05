const { sendSuccess } = require('../utils/api-response');

function createAccountController({ accountService, settingsService, documentService, appRegistryService }) {
    async function viewModel(user) {
        const [preferences, storage, applications] = await Promise.all([
            accountService.read(user.id),
            Promise.resolve(documentService.getQuota(user.id)),
            appRegistryService.list()
        ]);
        return {
            identity: {
                username: user.username,
                displayName: user.displayName,
                provider: 'Kyros'
            },
            preferences,
            storage,
            synchronization: {
                availableModules: applications.filter((app) => app.type === 'internal' || app.type === 'system').length,
                profileEnabled: preferences.syncProfile,
                appearanceEnabled: preferences.syncAppearance
            }
        };
    }

    return {
        async show(req, res) {
            return sendSuccess(res, await viewModel(req.user));
        },
        async update(req, res) {
            await accountService.update(req.user.id, req.body);
            return sendSuccess(res, await viewModel(req.user), 'Préférences du compte enregistrées.');
        },
        async context(req, res) {
            const [preferences, settings] = await Promise.all([
                accountService.read(req.user.id),
                settingsService.read(req.user.id)
            ]);
            return sendSuccess(res, {
                schemaVersion: 1,
                profile: preferences.syncProfile ? {
                    preferredName: preferences.preferredName || req.user.displayName,
                    language: preferences.language,
                    timeZone: preferences.timeZone
                } : null,
                appearance: preferences.syncAppearance ? {
                    theme: settings.theme,
                    accentColor: settings.accentColor,
                    density: settings.density,
                    motion: settings.motion
                } : null
            });
        }
    };
}

module.exports = { createAccountController };
