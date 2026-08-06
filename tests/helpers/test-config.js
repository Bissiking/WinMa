// tests/helpers/test-config.js
function createTestConfig(overrides = {}) {
    const kyrosOverrides = overrides.kyros || {};

    return {
        nodeEnv: 'test',
        isProduction: false,
        host: '127.0.0.1',
        port: 0,
        appBaseUrl: 'http://127.0.0.1:3000',
        version: '3.0.0-alpha.1',
        sessionSecret: 'test-session-secret-with-at-least-32-characters',
        sessionMaxAgeMs: 60 * 60 * 1000,
        ...overrides,
        harmonix: {
            baseUrl: 'https://harmonix.test',
            timeoutMs: 1000,
            ...(overrides.harmonix || {})
        },
        kyros: {
            enabled: true,
            baseUrl: 'https://kyros.test',
            authorizeUrl: 'https://kyros.test/authorize',
            tokenUrl: 'https://kyros.test/token',
            revokeUrl: 'https://kyros.test/revoke',
            clientId: 'cli_luma_os',
            clientSecret: 'test-client-secret',
            jwtSecret: 'test-jwt-secret-with-enough-entropy',
            issuer: 'kyros',
            audience: 'kyros-modules',
            resourceAudience: 'kyros:sso:luma-os',
            requestedScopes: ['profile', 'email'],
            requiredScopes: ['profile', 'email'],
            callbackUrl: 'http://127.0.0.1:3000/auth/callback',
            timeoutMs: 1000,
            ...kyrosOverrides
        }
    };
}

module.exports = { createTestConfig };
