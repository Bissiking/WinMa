// src/server/config/env.js
const crypto = require('node:crypto');
const dotenv = require('dotenv');
const { version } = require('../../../package.json');

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

function envWithFallback(env, lumaKey, kyrosKey) {
    const luma = env[lumaKey];
    if (luma !== undefined && luma !== '') return luma;
    const kyros = env[kyrosKey];
    if (kyros !== undefined && kyros !== '') return kyros;
    return undefined;
}

function loadConfig(environment = process.env) {
    const nodeEnv = environment.NODE_ENV || 'development';
    const isProduction = nodeEnv === 'production';
    const port = parseInteger(environment.PORT, 3000, 'PORT');
    const appBaseUrl = parseUrl(environment.APP_BASE_URL || `http://localhost:${port}`, 'APP_BASE_URL');
    const kyrosBaseUrl = parseUrl(
        envWithFallback(environment, 'LUMA_KYROS_BASE_URL', 'KYROS_BASE_URL'),
        'LUMA_KYROS_BASE_URL',
        { required: false }
    );
    const harmonixBaseUrl = parseUrl(
        environment.LUMA_HARMONIX_BASE_URL || 'https://mhemery.fr',
        'LUMA_HARMONIX_BASE_URL'
    );
    const sonoraStudioBaseUrl = parseUrl(
        environment.LUMA_SONORA_STUDIO_BASE_URL || 'http://localhost:6002',
        'LUMA_SONORA_STUDIO_BASE_URL'
    );
    const brainDumpBaseUrl = parseUrl(
        environment.LUMA_BRAINDUMP_BASE_URL || 'https://note-orbis.mhemery.fr',
        'LUMA_BRAINDUMP_BASE_URL'
    );
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
        tokenUrl: parseUrl(
            envWithFallback(environment, 'LUMA_KYROS_TOKEN_URL', 'KYROS_TOKEN_URL'),
            'LUMA_KYROS_TOKEN_URL',
            { required: false }
        ) || (kyrosBaseUrl ? `${kyrosBaseUrl}/token` : null),
        revokeUrl: parseUrl(
            envWithFallback(environment, 'LUMA_KYROS_REVOKE_URL', 'KYROS_REVOKE_URL'),
            'LUMA_KYROS_REVOKE_URL',
            { required: false }
        ) || (kyrosBaseUrl ? `${kyrosBaseUrl}/revoke` : null),
        clientId: envWithFallback(environment, 'LUMA_KYROS_CLIENT_ID', 'KYROS_CLIENT_ID') || '',
        clientSecret: envWithFallback(environment, 'LUMA_KYROS_CLIENT_SECRET', 'KYROS_CLIENT_SECRET') || '',
        jwtSecret: envWithFallback(environment, 'LUMA_KYROS_JWT_SECRET', 'KYROS_JWT_SECRET') || '',
        issuer: envWithFallback(environment, 'LUMA_KYROS_ISSUER', 'KYROS_ISSUER') || 'kyros',
        audience: envWithFallback(environment, 'LUMA_KYROS_AUDIENCE', 'KYROS_AUDIENCE') || 'kyros-modules',
        resourceAudience: envWithFallback(environment, 'LUMA_KYROS_RESOURCE_AUDIENCE', 'KYROS_RESOURCE_AUDIENCE') || '',
        requestedScopes: splitScopes(envWithFallback(environment, 'LUMA_KYROS_REQUESTED_SCOPES', 'KYROS_REQUESTED_SCOPE') || 'profile email'),
        requiredScopes: splitScopes(envWithFallback(environment, 'LUMA_KYROS_REQUIRED_SCOPES', 'KYROS_REQUIRED_SCOPES') || 'profile email'),
        callbackUrl: parseUrl(envWithFallback(environment, 'LUMA_KYROS_CALLBACK_URL', 'KYROS_CALLBACK_URL') || `${appBaseUrl}/auth/callback`, 'LUMA_KYROS_CALLBACK_URL'),
        timeoutMs: (() => {
            const lumaMs = environment.LUMA_KYROS_TIMEOUT_MS;
            if (lumaMs !== undefined) return parseInteger(lumaMs, 5000, 'LUMA_KYROS_TIMEOUT_MS');
            const kyrosSeconds = environment.KYROS_TIMEOUT_SECONDS;
            if (kyrosSeconds !== undefined) return parseInteger(kyrosSeconds, 5, 'KYROS_TIMEOUT_SECONDS') * 1000;
            return 5000;
        })(),
        ssoVersion: envWithFallback(environment, 'LUMA_KYROS_SSO_VERSION', 'KYROS_SSO_VERSION') || 'v3',
        edition: envWithFallback(environment, 'LUMA_KYROS_EDITION', 'KYROS_EDITION') || 'standard',
        applicationScope: envWithFallback(environment, 'LUMA_KYROS_APPLICATION_SCOPE', 'KYROS_APPLICATION_SCOPE') || 'standard'
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
        version,
        sessionSecret,
        sessionMaxAgeMs: 7 * 24 * 60 * 60 * 1000,
        harmonix: {
            baseUrl: harmonixBaseUrl,
            timeoutMs: parseInteger(environment.LUMA_HARMONIX_TIMEOUT_MS, 10000, 'LUMA_HARMONIX_TIMEOUT_MS')
        },
        sonoraStudio: {
            baseUrl: sonoraStudioBaseUrl,
            timeoutMs: parseInteger(environment.LUMA_SONORA_STUDIO_TIMEOUT_MS, 15000, 'LUMA_SONORA_STUDIO_TIMEOUT_MS')
        },
        brainDump: {
            baseUrl: brainDumpBaseUrl,
            timeoutMs: parseInteger(environment.LUMA_BRAINDUMP_TIMEOUT_MS, 10000, 'LUMA_BRAINDUMP_TIMEOUT_MS')
        },
        kyros
    };
}

module.exports = { loadConfig };
