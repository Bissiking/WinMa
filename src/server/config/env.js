// src/server/config/env.js
const crypto = require('node:crypto');
const dotenv = require('dotenv');

dotenv.config({ quiet: true });

function parseInteger(value, fallback, name) {
    const parsed = Number.parseInt(value ?? fallback, 10);

    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`${name} doit être un entier positif.`);
    }

    return parsed;
}

function parseUrl(value, name, { required = true } = {}) {
    if (!value && !required) {
        return null;
    }

    try {
        return new URL(value).toString().replace(/\/$/, '');
    } catch {
        throw new Error(`${name} doit être une URL valide.`);
    }
}

function splitScopes(value) {
    return String(value || '')
        .split(/\s+/)
        .map((scope) => scope.trim())
        .filter(Boolean);
}

function loadConfig(environment = process.env) {
    const nodeEnv = environment.NODE_ENV || 'development';
    const isProduction = nodeEnv === 'production';
    const port = parseInteger(environment.PORT, 3000, 'PORT');
    const appBaseUrl = parseUrl(environment.APP_BASE_URL || `http://localhost:${port}`, 'APP_BASE_URL');
    const kyrosBaseUrl = parseUrl(environment.LUMA_KYROS_BASE_URL, 'LUMA_KYROS_BASE_URL', { required: false });
    const sessionSecret = environment.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

    if (isProduction && !environment.SESSION_SECRET) {
        throw new Error('SESSION_SECRET est obligatoire en production.');
    }

    if (isProduction && !appBaseUrl.startsWith('https://')) {
        throw new Error('APP_BASE_URL doit utiliser HTTPS en production.');
    }

    const kyros = {
        baseUrl: kyrosBaseUrl,
        authorizeUrl: kyrosBaseUrl ? `${kyrosBaseUrl}/authorize` : null,
        tokenUrl: parseUrl(environment.LUMA_KYROS_TOKEN_URL, 'LUMA_KYROS_TOKEN_URL', { required: false }) || (kyrosBaseUrl ? `${kyrosBaseUrl}/token` : null),
        revokeUrl: parseUrl(environment.LUMA_KYROS_REVOKE_URL, 'LUMA_KYROS_REVOKE_URL', { required: false }) || (kyrosBaseUrl ? `${kyrosBaseUrl}/revoke` : null),
        clientId: environment.LUMA_KYROS_CLIENT_ID || '',
        clientSecret: environment.LUMA_KYROS_CLIENT_SECRET || '',
        jwtSecret: environment.LUMA_KYROS_JWT_SECRET || '',
        issuer: environment.LUMA_KYROS_ISSUER || 'kyros',
        audience: environment.LUMA_KYROS_AUDIENCE || 'kyros-modules',
        resourceAudience: environment.LUMA_KYROS_RESOURCE_AUDIENCE || '',
        requestedScopes: splitScopes(environment.LUMA_KYROS_REQUESTED_SCOPES || 'profile email'),
        requiredScopes: splitScopes(environment.LUMA_KYROS_REQUIRED_SCOPES || 'profile email'),
        callbackUrl: parseUrl(environment.LUMA_KYROS_CALLBACK_URL || `${appBaseUrl}/auth/callback`, 'LUMA_KYROS_CALLBACK_URL'),
        timeoutMs: parseInteger(environment.LUMA_KYROS_TIMEOUT_MS, 5000, 'LUMA_KYROS_TIMEOUT_MS')
    };

    kyros.enabled = Boolean(
        kyros.authorizeUrl &&
        kyros.tokenUrl &&
        kyros.clientId &&
        kyros.clientSecret &&
        kyros.jwtSecret &&
        kyros.resourceAudience
    );

    if (isProduction && !kyros.enabled) {
        throw new Error('La configuration Kyros Luma OS est incomplète en production.');
    }

    return {
        nodeEnv,
        isProduction,
        host: environment.HOST || '127.0.0.1',
        port,
        appBaseUrl,
        sessionSecret,
        sessionMaxAgeMs: 7 * 24 * 60 * 60 * 1000,
        kyros
    };
}

module.exports = { loadConfig };
