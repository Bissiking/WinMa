// src/server/config/security.js
const helmet = require('helmet');

// Origines iframes acceptées dans frame-src : https strict, host[:port] uniquement
// (pas de chemin, pas de credentials). Défense en profondeur après la validation
// du registre d'applications.
function normalizeFrameOrigin(value) {
    if (typeof value !== 'string' || !value.trim()) {
        return null;
    }
    try {
        const url = new URL(value.trim());
        if (url.protocol !== 'https:') {
            return null;
        }
        if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
            return null;
        }
        return url.origin;
    } catch {
        return null;
    }
}

function createSecurityMiddleware(config, { allowedFrameOrigins = [] } = {}) {
    const frameOrigins = [...new Set(
        allowedFrameOrigins.map(normalizeFrameOrigin).filter(Boolean)
    )];

    return helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                // Aucun script inline ni CDN externe : seuls des modules locaux servis en 'self'.
                scriptSrc: ["'self'"],
                // Aucun attribut d'événement inline (onclick, etc.) n'est autorisé.
                scriptSrcAttr: ["'none'"],
                // Exception documentée : 9 attributs style="" dynamiques (barres de
                // progression, swatches, hauteurs) dans les apps internes. 'unsafe-inline'
                // sur les styles n'autorise pas l'exécution de code.
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", 'data:', 'blob:'],
                mediaSrc: ["'self'", 'blob:'],
                fontSrc: ["'self'"],
                connectSrc: ["'self'"],
                // 'self' + origines déclarées dans le registre (apps type iframe).
                frameSrc: ["'self'", ...frameOrigins],
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

module.exports = { createSecurityMiddleware, normalizeFrameOrigin };
