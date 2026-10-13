// src/server/services/kyros-service.js
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { HttpError } = require('../utils/http-error');

const PKCE_VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;
const PKCE_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const JWKS_CACHE_TTL_MS = 5 * 60 * 1000;

function assertTokenResponse(payload) {
    if (
        !payload ||
        typeof payload.access_token !== 'string' ||
        typeof payload.refresh_token !== 'string'
    ) {
        throw new HttpError(502, 'KYROS_INVALID_RESPONSE', 'Réponse Kyros invalide.');
    }
}

function createPkceVerifier() {
    return crypto.randomBytes(48).toString('base64url');
}

function computePkceChallenge(verifier) {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
}

function jwkToPublicKey(jwk) {
    return crypto.createPublicKey({ key: jwk, format: 'jwk' });
}

function createKyrosService(config, fetchImplementation = globalThis.fetch) {
    if (typeof fetchImplementation !== 'function') {
        throw new Error('Une implémentation de fetch est requise.');
    }

    // Cache JWKS (v4) : kid → clé publique. fetchedAt permet la re-rotation,
    // refreshedDuringCall la garde anti-boucle (un seul re-fetch par vérification).
    let jwksCache = { keys: new Map(), fetchedAt: 0 };

    function isV4() {
        return config.ssoVersion !== 'v3';
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

    function buildAuthorizeUrlV3(state) {
        const authorizeUrl = new URL(config.authorizeUrl);
        authorizeUrl.searchParams.set('client_id', config.clientId);
        authorizeUrl.searchParams.set('redirect_uri', config.callbackUrl);
        authorizeUrl.searchParams.set('scope', config.requestedScopes.join(' '));
        authorizeUrl.searchParams.set('state', state);
        authorizeUrl.searchParams.set('kyros_sso_version', config.ssoVersion);
        authorizeUrl.searchParams.set('kyros_edition', config.edition);
        authorizeUrl.searchParams.set('kyros_application_scope', config.applicationScope);
        return { url: authorizeUrl.toString(), codeVerifier: null };
    }

    async function buildAuthorizeUrl(state) {
        requireConfiguration();
        if (!isV4()) {
            return buildAuthorizeUrlV3(state);
        }

        const codeVerifier = createPkceVerifier();
        const par = await postJson(config.parUrl, {
            client_id: config.clientId,
            redirect_uri: config.callbackUrl,
            scope: config.requestedScopes.join(' '),
            state,
            code_challenge: computePkceChallenge(codeVerifier),
            code_challenge_method: 'S256'
        });

        if (!par || typeof par.request_uri !== 'string' || !par.request_uri) {
            throw new HttpError(502, 'KYROS_INVALID_RESPONSE', "Kyros n'a pas retourné de request_uri.");
        }

        const authorizeUrl = new URL(config.authorizeUrl);
        authorizeUrl.searchParams.set('client_id', config.clientId);
        authorizeUrl.searchParams.set('request_uri', par.request_uri);
        return { url: authorizeUrl.toString(), codeVerifier };
    }

    async function postJson(url, body) {
        requireConfiguration();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
        const bodyWithHandshake = {
            ...body,
            kyros_sso_version: config.ssoVersion,
            kyros_edition: config.edition,
            kyros_application_scope: config.applicationScope
        };

        try {
            const response = await fetchImplementation(url, {
                method: 'POST',
                headers: {
                    accept: 'application/json',
                    'content-type': 'application/json'
                },
                body: JSON.stringify(bodyWithHandshake),
                signal: controller.signal
            });
            const payload = await response.json().catch(() => null);

            if (!response.ok) {
                const providerCode = payload?.error || 'kyros_request_failed';
                const error = new HttpError(401, 'KYROS_AUTH_FAILED', `Kyros a refusé la requête (${providerCode}).`);
                error.providerCode = providerCode;
                throw error;
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

    async function fetchJwks() {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

        try {
            const response = await fetchImplementation(config.jwksUrl, {
                method: 'GET',
                headers: { accept: 'application/json' },
                signal: controller.signal
            });
            const payload = await response.json().catch(() => null);

            if (!response.ok || !payload || !Array.isArray(payload.keys)) {
                throw new HttpError(502, 'KYROS_INVALID_RESPONSE', "Le JWKS Kyros est invalide.");
            }

            const keys = new Map();
            for (const jwk of payload.keys) {
                if (jwk && typeof jwk.kid === 'string' && jwk.kty === 'RSA') {
                    keys.set(jwk.kid, jwkToPublicKey(jwk));
                }
            }

            jwksCache = { keys, fetchedAt: Date.now() };
            return keys;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new HttpError(504, 'KYROS_TIMEOUT', 'Kyros ne répond pas dans le délai attendu.');
            }

            if (error instanceof HttpError) {
                throw error;
            }

            throw new HttpError(502, 'KYROS_UNAVAILABLE', 'Le service de clés Kyros est temporairement indisponible.');
        } finally {
            clearTimeout(timeout);
        }
    }

    async function resolveSigningKey(header) {
        const kid = header?.kid;
        let refreshedDuringCall = false;

        const cacheIsStale = Date.now() - jwksCache.fetchedAt > JWKS_CACHE_TTL_MS;
        if (cacheIsStale || jwksCache.keys.size === 0) {
            await fetchJwks();
            refreshedDuringCall = true;
        }

        let key = typeof kid === 'string' ? jwksCache.keys.get(kid) : undefined;
        if (!key && !refreshedDuringCall) {
            await fetchJwks();
            key = typeof kid === 'string' ? jwksCache.keys.get(kid) : undefined;
        }

        if (!key) {
            throw new HttpError(401, 'KYROS_INVALID_TOKEN', 'Le jeton Kyros est invalide.');
        }

        return key;
    }

    function assertClaims(claims) {
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

    async function verifyAccessToken(accessToken) {
        requireConfiguration();

        let claims;

        try {
            if (isV4()) {
                const envelope = jwt.decode(accessToken, { complete: true });
                const key = await resolveSigningKey(envelope?.header);
                claims = jwt.verify(accessToken, key, {
                    algorithms: ['RS256'],
                    issuer: config.issuer,
                    audience: config.audience,
                    clockTolerance: 5
                });
            } else {
                claims = jwt.verify(accessToken, config.jwtSecret, {
                    algorithms: ['HS256'],
                    issuer: config.issuer,
                    audience: config.audience,
                    clockTolerance: 5
                });
            }
        } catch (error) {
            if (error instanceof HttpError) {
                throw error;
            }

            throw new HttpError(401, 'KYROS_INVALID_TOKEN', 'Le jeton Kyros est invalide.');
        }

        if (isV4() && claims.sso_version !== 'v4') {
            throw new HttpError(401, 'KYROS_INVALID_TOKEN', 'Le jeton Kyros est invalide.');
        }

        return assertClaims(claims);
    }

    async function exchangeAuthorizationCode(code, codeVerifier = null) {
        const body = {
            grant_type: 'authorization_code',
            client_id: config.clientId,
            client_secret: config.clientSecret,
            code,
            redirect_uri: config.callbackUrl
        };

        if (isV4()) {
            if (typeof codeVerifier !== 'string' || !PKCE_VERIFIER_PATTERN.test(codeVerifier)) {
                throw new HttpError(400, 'KYROS_PKCE_MISSING', 'Le code PKCE de la demande est absent.');
            }

            body.code_verifier = codeVerifier;
        }

        const tokens = await postJson(config.tokenUrl, body);
        assertTokenResponse(tokens);
        return { tokens, claims: await verifyAccessToken(tokens.access_token) };
    }

    async function refresh(refreshToken) {
        const tokens = await postJson(config.tokenUrl, {
            grant_type: 'refresh_token',
            client_id: config.clientId,
            client_secret: config.clientSecret,
            refresh_token: refreshToken
        });
        assertTokenResponse(tokens);
        return { tokens, claims: await verifyAccessToken(tokens.access_token) };
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

    function normalizeAvatarUrl(value) {
        if (typeof value !== 'string' || !value.trim() || !config.baseUrl) {
            return value || null;
        }

        try {
            return new URL(value, config.baseUrl).toString();
        } catch {
            return value;
        }
    }

    async function fetchAvatar(avatarUrl) {
        const absoluteUrl = normalizeAvatarUrl(avatarUrl);
        if (!absoluteUrl) {
            return null;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

        try {
            const response = await fetchImplementation(absoluteUrl, {
                method: 'GET',
                signal: controller.signal
            });

            if (!response.ok) {
                return null;
            }

            return {
                body: response.body,
                contentType: response.headers.get('content-type') || 'image/jpeg'
            };
        } catch (error) {
            if (error.name === 'AbortError') {
                return null;
            }

            return null;
        } finally {
            clearTimeout(timeout);
        }
    }

    // Push Luma → Kyros : PATCH /api/me/profile en best-effort (scope profile).
    // Retourne true si le profil Kyros a été mis à jour, false sinon
    // (timeout, 4xx/5xx, réseau) — l'échec ne casse jamais la sauvegarde locale.
    async function updateProfile(accessToken, profile) {
        if (!accessToken || !config.enabled) {
            return false;
        }

        const profileUrl = new URL('/api/me/profile', config.baseUrl).toString();
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

        try {
            const response = await fetchImplementation(profileUrl, {
                method: 'PATCH',
                headers: {
                    accept: 'application/json',
                    'content-type': 'application/json',
                    authorization: `Bearer ${accessToken}`
                },
                body: JSON.stringify(profile),
                signal: controller.signal
            });
            return response.ok;
        } catch {
            return false;
        } finally {
            clearTimeout(timeout);
        }
    }

    return {
        buildAuthorizeUrl,
        exchangeAuthorizationCode,
        refresh,
        revoke,
        verifyAccessToken,
        normalizeAvatarUrl,
        fetchAvatar,
        updateProfile
    };
}

module.exports = { createKyrosService, PKCE_CHALLENGE_PATTERN, PKCE_VERIFIER_PATTERN };
