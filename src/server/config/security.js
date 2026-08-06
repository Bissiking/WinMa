// src/server/config/security.js
const helmet = require('helmet');

function createSecurityMiddleware(config) {
    return helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
                scriptSrcAttr: ["'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'blob:'],
                fontSrc: ["'self'"],
                connectSrc: ["'self'"],
                frameSrc: ["'self'", 'https://mhemery.fr', 'https://jelly.mhemery.fr'],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'"],
                frameAncestors: ["'self'"],
                upgradeInsecureRequests: config.isProduction ? [] : null
            }
        },
        crossOriginEmbedderPolicy: false,
        hsts: config.isProduction
            ? { maxAge: 31536000, includeSubDomains: true }
            : false,
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
    });
}

module.exports = { createSecurityMiddleware };
