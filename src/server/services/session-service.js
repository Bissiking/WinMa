// src/server/services/session-service.js
const { HttpError } = require('../utils/http-error');

const FATAL_REFRESH_CODES = new Set(['invalid_grant', 'invalid_token', 'unauthorized_client']);

function regenerateSession(req) {
    return new Promise((resolve, reject) => {
        req.session.regenerate((error) => (error ? reject(error) : resolve()));
    });
}

function saveSession(req) {
    return new Promise((resolve, reject) => {
        req.session.save((error) => (error ? reject(error) : resolve()));
    });
}

function destroySession(req) {
    return new Promise((resolve, reject) => {
        req.session.destroy((error) => (error ? reject(error) : resolve()));
    });
}

function toMinimalUser(tokens, claims, kyrosService) {
    const providerUser = tokens.user || {};
    const id = claims.sub || providerUser.id;
    const username = providerUser.username || claims.username;

    if (!id || !username) {
        throw new HttpError(502, 'KYROS_PROFILE_INVALID', 'Le profil Kyros est incomplet.');
    }

    const rawAvatarUrl = providerUser.avatarUrl || claims.picture || claims.avatar_url || null;

    return {
        id: String(id),
        username: String(username),
        displayName: String(providerUser.displayName || claims.display_name || username),
        avatar: 'default',
        avatarUrl: kyrosService.normalizeAvatarUrl(rawAvatarUrl)
    };
}

function createSessionService(kyrosService, { onAuthenticated } = {}) {
    // Single-flight : un seul refresh en vol par refresh token, pour éviter
    // que deux requêtes parallèles n'utilisent le même token rotatif.
    const inFlightRefreshes = new Map();

    // Hook best-effort après login/refresh : ex. pull du profil Kyros vers
    // les préférences locales. Une erreur ne doit jamais casser l'auth.
    async function notifyAuthenticated(req, claims) {
        if (typeof onAuthenticated !== 'function') {
            return;
        }
        try {
            await onAuthenticated(req, claims);
        } catch {
            // volontairement silencieux
        }
    }

    async function establish(req, tokens, claims) {
        const user = toMinimalUser(tokens, claims, kyrosService);
        await regenerateSession(req);
        req.session.user = user;
        req.session.establishedAt = Date.now();
        req.session.kyros = {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            accessTokenExpiresAt: Number(claims.exp) * 1000,
            refreshTokenExpiresAt: tokens.refresh_token_expires_at || null
        };
        await saveSession(req);
        await notifyAuthenticated(req, claims);
        return user;
    }

    async function refreshAccessToken(refreshToken) {
        let pending = inFlightRefreshes.get(refreshToken);
        if (pending) return pending;

        pending = kyrosService.refresh(refreshToken).finally(() => {
            inFlightRefreshes.delete(refreshToken);
        });
        inFlightRefreshes.set(refreshToken, pending);
        return pending;
    }

    async function refreshIfNeeded(req) {
        if (!req.session?.user || !req.session.kyros) {
            return null;
        }

        if (req.session.kyros.accessTokenExpiresAt > Date.now() + 30_000) {
            return req.session.user;
        }

        try {
            const { tokens, claims } = await refreshAccessToken(req.session.kyros.refreshToken);
            req.session.user = toMinimalUser(tokens, claims, kyrosService);
            req.session.kyros = {
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                accessTokenExpiresAt: Number(claims.exp) * 1000,
                refreshTokenExpiresAt: tokens.refresh_token_expires_at || null
            };
            await saveSession(req);
            await notifyAuthenticated(req, claims);
            return req.session.user;
        } catch (error) {
            // Détruire la session uniquement sur un rejet autorisé du refresh
            // (token révoqué / expiré / réutilisé). Un timeout ou une erreur
            // réseau conserve la session : l'utilisateur ne devrait pas être
            // déconnecté pour une panne transitoire de Kyros.
            const isFatal =
                error instanceof HttpError &&
                error.code === 'KYROS_AUTH_FAILED' &&
                FATAL_REFRESH_CODES.has(error.providerCode);
            if (isFatal) {
                await destroySession(req).catch(() => undefined);
            }
            throw error;
        }
    }

    async function logout(req) {
        const refreshToken = req.session?.kyros?.refreshToken;

        try {
            await kyrosService.revoke(refreshToken);
        } finally {
            if (req.session) {
                await destroySession(req);
            }
        }
    }

    return { establish, refreshIfNeeded, logout, saveSession };
}

module.exports = { createSessionService };
