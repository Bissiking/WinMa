const { sendSuccess } = require('../utils/api-response');

function createAccountController({ accountService, settingsService, documentService, appRegistryService, kyrosService }) {
    // Le snapshot de synchronisme est un détail interne : il ne doit pas
    // fuiter dans l'API publique des préférences.
    function publicPreferences(preferences) {
        const { lastProfileSync, ...rest } = preferences;
        return rest;
    }

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
            preferences: publicPreferences(preferences),
            storage,
            synchronization: {
                availableModules: applications.filter((app) => app.type === 'internal' || app.type === 'system').length,
                profileEnabled: preferences.syncProfile,
                appearanceEnabled: preferences.syncAppearance
            }
        };
    }

    // Push Luma → Kyros (best-effort) : PATCH /api/me/profile avec le jeton de
    // la session. En cas de succès, le snapshot est mis à jour ; sinon un
    // avertissement remonte au client (sauvegarde locale conservée).
    async function pushProfile(user, account, accessToken) {
        if (typeof kyrosService?.updateProfile !== 'function') {
            return null;
        }

        const locale = account.language;
        const timezone = account.timeZone === 'auto' ? undefined : account.timeZone;
        const displayName = account.preferredName || user.displayName;

        const pushed = await kyrosService.updateProfile(accessToken, { displayName, locale, timezone });
        if (pushed) {
            await accountService.update(user.id, {
                lastProfileSync: accountService.snapshotFromClaims({
                    display_name: displayName,
                    locale,
                    timezone
                })
            });
            return null;
        }
        return 'Profil Kyros non synchronisé : le service est injoignable. Vos préférences locales sont enregistrées.';
    }

    return {
        async show(req, res) {
            return sendSuccess(res, await viewModel(req.user));
        },
        async update(req, res) {
            const account = await accountService.update(req.user.id, req.body);
            let profileSyncWarning = null;

            if (account.syncProfile) {
                profileSyncWarning = await pushProfile(req.user, account, req.session?.kyros?.accessToken);
            }

            return sendSuccess(res, { ...(await viewModel(req.user)), profileSyncWarning }, 'Préférences du compte enregistrées.');
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
