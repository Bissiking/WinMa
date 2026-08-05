// src/server/services/session-service.js
const { HttpError } = require('../utils/http-error');

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

function toMinimalUser(tokens, claims) {
    const providerUser = tokens.user || {};
    const id = claims.sub || providerUser.id;
    const username = providerUser.username || claims.username;

    if (!id || !username) {
        throw new HttpError(502, 'KYROS_PROFILE_INVALID', 'Le profil Kyros est incomplet.');
    }

    return {
        id: String(id),
        username: String(username),
        displayName: String(providerUser.displayName || claims.display_name || username),
        avatar: 'default'
    };
}

function createSessionService(kyrosService) {
    async function establish(req, tokens, claims) {
        const user = toMinimalUser(tokens, claims);
        await regenerateSession(req);
        req.session.user = user;
        req.session.kyros = {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            accessTokenExpiresAt: Number(claims.exp) * 1000,
            refreshTokenExpiresAt: tokens.refresh_token_expires_at || null
        };
        await saveSession(req);
        return user;
    }

    async function refreshIfNeeded(req) {
        if (!req.session?.user || !req.session.kyros) {
            return null;
        }

        if (req.session.kyros.accessTokenExpiresAt > Date.now() + 30_000) {
            return req.session.user;
        }

        try {
            const { tokens, claims } = await kyrosService.refresh(req.session.kyros.refreshToken);
            req.session.user = toMinimalUser(tokens, claims);
            req.session.kyros = {
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                accessTokenExpiresAt: Number(claims.exp) * 1000,
                refreshTokenExpiresAt: tokens.refresh_token_expires_at || null
            };
            await saveSession(req);
            return req.session.user;
        } catch (error) {
            await destroySession(req).catch(() => undefined);
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
