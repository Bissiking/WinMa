// src/server/controllers/auth-controller.js
const crypto = require('node:crypto');
const { HttpError } = require('../utils/http-error');
const { sendSuccess } = require('../utils/api-response');

const AUTH_STATE_TTL_MS = 10 * 60 * 1000;

function statesMatch(expected, received) {
    if (!expected || !received) {
        return false;
    }

    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(received);
    return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

function createAuthController({ config, kyrosService, sessionService }) {
    async function login(req, res) {
        const state = crypto.randomBytes(32).toString('base64url');
        req.session.kyrosAuthorization = { state, createdAt: Date.now() };
        await sessionService.saveSession(req);
        return res.redirect(302, kyrosService.buildAuthorizeUrl(state));
    }

    async function callback(req, res) {
        const pending = req.session?.kyrosAuthorization;
        delete req.session.kyrosAuthorization;

        if (req.query.error) {
            throw new HttpError(401, 'KYROS_AUTH_CANCELLED', 'La connexion Kyros a été annulée ou refusée.');
        }

        if (
            !pending ||
            Date.now() - pending.createdAt > AUTH_STATE_TTL_MS ||
            !statesMatch(pending.state, req.query.state)
        ) {
            throw new HttpError(400, 'KYROS_STATE_INVALID', 'La demande de connexion a expiré ou est invalide.');
        }

        if (typeof req.query.code !== 'string' || !req.query.code) {
            throw new HttpError(400, 'KYROS_CODE_MISSING', 'Le code de connexion Kyros est absent.');
        }

        const { tokens, claims } = await kyrosService.exchangeAuthorizationCode(req.query.code);
        await sessionService.establish(req, tokens, claims);
        return res.redirect(303, config.appBaseUrl);
    }

    async function logout(req, res) {
        await sessionService.logout(req);
        res.clearCookie('luma.sid', {
            httpOnly: true,
            sameSite: 'lax',
            secure: config.isProduction,
            path: '/'
        });
        return sendSuccess(res, null, 'Session terminée.');
    }

    return { login, callback, logout };
}

module.exports = { createAuthController };
