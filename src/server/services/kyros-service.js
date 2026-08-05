// src/server/services/kyros-service.js
const jwt = require('jsonwebtoken');
const { HttpError } = require('../utils/http-error');

function assertTokenResponse(payload) {
    if (
        !payload ||
        typeof payload.access_token !== 'string' ||
        typeof payload.refresh_token !== 'string'
    ) {
        throw new HttpError(502, 'KYROS_INVALID_RESPONSE', 'Réponse Kyros invalide.');
    }
}

function createKyrosService(config, fetchImplementation = globalThis.fetch) {
    if (typeof fetchImplementation !== 'function') {
        throw new Error('Une implémentation de fetch est requise.');
    }

    function requireConfiguration() {
        if (!config.enabled) {
            throw new HttpError(
                503,
                'KYROS_NOT_CONFIGURED',
                "L'authentification Kyros de Luma OS n'est pas encore configurée."
            );
        }
    }

    function buildAuthorizeUrl(state) {
        requireConfiguration();
        const authorizeUrl = new URL(config.authorizeUrl);
        authorizeUrl.searchParams.set('client_id', config.clientId);
        authorizeUrl.searchParams.set('redirect_uri', config.callbackUrl);
        authorizeUrl.searchParams.set('scope', config.requestedScopes.join(' '));
        authorizeUrl.searchParams.set('state', state);
        return authorizeUrl.toString();
    }

    async function postJson(url, body) {
        requireConfiguration();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

        try {
            const response = await fetchImplementation(url, {
                method: 'POST',
                headers: {
                    accept: 'application/json',
                    'content-type': 'application/json'
                },
                body: JSON.stringify(body),
                signal: controller.signal
            });
            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                const providerCode = payload?.error || 'kyros_request_failed';
                throw new HttpError(401, 'KYROS_AUTH_FAILED', `Kyros a refusé la requête (${providerCode}).`);
            }

            return payload;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new HttpError(504, 'KYROS_TIMEOUT', 'Kyros ne répond pas dans le délai attendu.');
            }

            if (error instanceof HttpError) {
                throw error;
            }

            throw new HttpError(502, 'KYROS_UNAVAILABLE', 'Kyros est temporairement indisponible.');
        } finally {
            clearTimeout(timeout);
        }
    }

    function verifyAccessToken(accessToken) {
        requireConfiguration();
        let claims;

        try {
            claims = jwt.verify(accessToken, config.jwtSecret, {
                algorithms: ['HS256'],
                issuer: config.issuer,
                audience: config.audience,
                clockTolerance: 5
            });
        } catch {
            throw new HttpError(401, 'KYROS_INVALID_TOKEN', 'Le jeton Kyros est invalide.');
        }

        if (claims.resource_aud !== config.resourceAudience) {
            throw new HttpError(401, 'KYROS_WRONG_RESOURCE', "Le jeton Kyros n'est pas destiné à Luma OS.");
        }

        if (claims.client_id !== config.clientId) {
            throw new HttpError(401, 'KYROS_WRONG_CLIENT', 'Le client Kyros du jeton est invalide.');
        }

        const grantedScopes = new Set(String(claims.scope || '').split(/\s+/).filter(Boolean));
        const missingScope = config.requiredScopes.find((scope) => !grantedScopes.has(scope));

        if (missingScope) {
            throw new HttpError(403, 'KYROS_SCOPE_MISSING', `Le scope Kyros ${missingScope} est requis.`);
        }

        return claims;
    }

    async function exchangeAuthorizationCode(code) {
        const tokens = await postJson(config.tokenUrl, {
            grant_type: 'authorization_code',
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code,
            redirect_uri: config.callbackUrl
        });
        assertTokenResponse(tokens);
        return { tokens, claims: verifyAccessToken(tokens.access_token) };
    }

    async function refresh(refreshToken) {
        const tokens = await postJson(config.tokenUrl, {
            grant_type: 'refresh_token',
            client_id: config.clientId,
            client_secret: config.clientSecret,
            refresh_token: refreshToken
        });
        assertTokenResponse(tokens);
        return { tokens, claims: verifyAccessToken(tokens.access_token) };
    }

    async function revoke(refreshToken) {
        if (!refreshToken || !config.enabled) {
            return;
        }

        await postJson(config.revokeUrl, {
            client_id: config.clientId,
            client_secret: config.clientSecret,
            refresh_token: refreshToken
        });
    }

    return {
        buildAuthorizeUrl,
        exchangeAuthorizationCode,
        refresh,
        revoke,
        verifyAccessToken
    };
}

module.exports = { createKyrosService };
