// tests/helpers/fake-kyros.js
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

const REQUIRED_HANDSHAKE = {
    kyros_sso_version: 'v4',
    kyros_edition: 'standard',
    kyros_application_scope: 'standard'
};

function jsonResponse(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' }
    });
}

function handshakeMatches(body) {
    return Object.entries(REQUIRED_HANDSHAKE).every(([key, value]) => body?.[key] === value);
}

function createFakeKyros(config) {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    const kid = 'fake-kyros-sso-v4-1';
    const jwk = { ...publicKey.export({ format: 'jwk' }), kid, use: 'sig', alg: 'RS256' };

    const calls = [];
    const parRequests = new Map();
    const authCodes = new Map();
    const refreshTokens = new Set(['refresh-token-next']);
    const avatarFixtures = new Map();
    const profileUpdates = [];
    let nextRefreshError = null;
    let nextProfileError = null;
    let tokenClaimsOverrides = null;

    function setTokenClaims(overrides) {
        tokenClaimsOverrides = overrides;
    }

    function serveAvatar(url, { contentType = 'image/jpeg', body = Buffer.from('fake-avatar-image') } = {}) {
        avatarFixtures.set(url, { contentType, body });
    }

    function signAccessToken(overrides = {}) {
        const now = Math.floor(Date.now() / 1000);
        return jwt.sign(
            {
                iss: config.kyros.issuer,
                aud: config.kyros.audience,
                resource_aud: config.kyros.resourceAudience,
                sub: 'usr_luma',
                client_id: config.kyros.clientId,
                scope: 'profile email',
                username: 'matheo',
                display_name: 'Matheo',
                picture: null,
                sso_version: 'v4',
                jti: crypto.randomUUID(),
                nbf: now - 5,
                ...overrides
            },
            privateKey,
            { algorithm: 'RS256', keyid: kid, expiresIn: '15m' }
        );
    }

    function tokenPair(overrides = {}) {
        return {
            token_type: 'Bearer',
            access_token: signAccessToken(tokenClaimsOverrides),
            expires_in: 900,
            refresh_token: 'refresh-token-next',
            refresh_token_expires_at: '2099-01-01T00:00:00.000Z',
            scope: 'profile email',
            user: {
                id: 'usr_luma',
                username: 'matheo',
                email: 'not-exposed@example.test',
                displayName: 'Matheo',
                role: 'admin'
            }
        };
    }

    async function fetchImplementation(url, options = {}) {
        const method = options.method || 'GET';
        const body = typeof options.body === 'string' ? JSON.parse(options.body) : null;
        calls.push({ url, method, body });

        if (avatarFixtures.has(url)) {
            const fixture = avatarFixtures.get(url);
            return new Response(fixture.body, {
                status: 200,
                headers: { 'content-type': fixture.contentType }
            });
        }

        if (url.endsWith('/sso/v4/jwks')) {
            return jsonResponse({ keys: [jwk] });
        }

        if (url.endsWith('/par')) {
            if (!handshakeMatches(body)) return jsonResponse({ error: 'sso_version_mismatch' }, 400);
            if (!body.client_id) return jsonResponse({ error: 'missing_parameters' }, 400);
            if (typeof body.code_challenge !== 'string' || !/^[A-Za-z0-9_-]{43,128}$/.test(body.code_challenge)) {
                return jsonResponse({ error: 'invalid_request' }, 400);
            }
            if (body.code_challenge_method !== 'S256') return jsonResponse({ error: 'invalid_request' }, 400);
            const requestUri = `urn:ietf:params:oauth:request_uri:${crypto.randomBytes(32).toString('base64url')}`;
            parRequests.set(requestUri, { ...body });
            return jsonResponse({ request_uri: requestUri, expires_in: 90 }, 201);
        }

        if (url.endsWith('/token')) {
            if (!handshakeMatches(body)) return jsonResponse({ error: 'sso_version_mismatch' }, 400);

            if (body.grant_type === 'authorization_code') {
                if (!body.code || !body.redirect_uri) return jsonResponse({ error: 'invalid_request' }, 400);
                if (typeof body.code_verifier !== 'string' || !/^[A-Za-z0-9._~-]{43,128}$/.test(body.code_verifier)) {
                    return jsonResponse({ error: 'invalid_code' }, 400);
                }
                const record = authCodes.get(body.code);
                if (!record) return jsonResponse({ error: 'invalid_code' }, 400);
                const actualChallenge = crypto.createHash('sha256').update(body.code_verifier).digest('base64url');
                if (actualChallenge !== record.codeChallenge) return jsonResponse({ error: 'invalid_code' }, 400);
                authCodes.delete(body.code);
                return jsonResponse(tokenPair());
            }

            if (body.grant_type === 'refresh_token') {
                if (nextRefreshError) {
                    const code = nextRefreshError;
                    nextRefreshError = null;
                    return jsonResponse({ error: code }, 401);
                }
                if (!refreshTokens.has(body.refresh_token)) return jsonResponse({ error: 'invalid_grant' }, 401);
                return jsonResponse(tokenPair());
            }

            return jsonResponse({ error: 'unsupported_grant_type' }, 400);
        }

        if (url.endsWith('/revoke')) {
            return jsonResponse({ revoked: true });
        }

        // Proxy du profil Kyros (PATCH /api/me/profile) : best-effort côté Luma,
        // donc le fake peut simuler une panne avec failNextProfileWith().
        if (url.endsWith('/api/me/profile') && method === 'PATCH') {
            const authorization = options.headers?.authorization || '';
            if (!authorization.startsWith('Bearer ')) {
                return jsonResponse({ error: 'unauthorized' }, 401);
            }
            if (nextProfileError) {
                const status = nextProfileError;
                nextProfileError = null;
                return jsonResponse({ error: 'kyros_unavailable' }, status);
            }
            profileUpdates.push({ ...body });
            return jsonResponse({
                display_name: body?.displayName ?? 'Matheo',
                locale: body?.locale ?? 'fr-FR',
                timezone: body?.timezone ?? 'Europe/Paris'
            });
        }

        return jsonResponse({ error: 'not_found' }, 404);
    }

    // Simule l'issue du code d'autorisation par /authorize : le code est lié au
    // dernier PAR (single-use) et porte le code_challenge du client.
    function completeAuthorization(state) {
        const lastPar = [...parRequests.entries()].at(-1);
        if (!lastPar) throw new Error('Aucun PAR ne précède la complétion de l’autorisation.');
        const [requestUri, parameters] = lastPar;
        parRequests.delete(requestUri);
        const code = crypto.randomBytes(24).toString('hex');
        authCodes.set(code, { codeChallenge: parameters.code_challenge });
        return { code, state: state ?? parameters.state, iss: config.kyros.issuer };
    }

    function failNextRefreshWith(code) {
        nextRefreshError = code;
    }

    function failNextProfileWith(status = 502) {
        nextProfileError = status;
    }

    return {
        fetchImplementation,
        completeAuthorization,
        failNextRefreshWith,
        failNextProfileWith,
        signAccessToken,
        setTokenClaims,
        serveAvatar,
        calls,
        profileUpdates,
        publicKey
    };
}

// Enchaîne login → PAR → callback et retourne le cookie de session authentifié.
async function loginAs(baseUrl, fake, { extractCookie }) {
    const loginResponse = await fetch(`${baseUrl}/auth/login`, { redirect: 'manual' });
    const loginCookie = extractCookie(loginResponse);
    const authorizeUrl = new URL(loginResponse.headers.get('location'));
    // En v4 le state voyage dans le PAR, pas dans l'URL de redirection.
    const { code, state, iss } = fake.completeAuthorization(authorizeUrl.searchParams.get('state') || undefined);
    const callbackResponse = await fetch(
        `${baseUrl}/auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}&iss=${encodeURIComponent(iss)}`,
        { headers: { cookie: loginCookie }, redirect: 'manual' }
    );
    return { callbackResponse, cookie: extractCookie(callbackResponse) };
}

module.exports = { createFakeKyros, loginAs, REQUIRED_HANDSHAKE };
