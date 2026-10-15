// src/server/routes/auth-routes.js
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { asyncHandler } = require('../utils/async-handler');

function createAuthRoutes(authController, requireSameOrigin) {
    const router = express.Router();
    const authLimiter = rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: 30,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: {
            success: false,
            data: null,
            message: 'Trop de tentatives. Réessayez dans quelques minutes.',
            code: 'RATE_LIMITED'
        }
    });

    router.get('/auth/login', authLimiter, asyncHandler(authController.login));
    router.get('/auth/callback', authLimiter, asyncHandler(authController.callback));
    router.post('/api/auth/logout', requireSameOrigin, asyncHandler(authController.logout));
    return router;
}

module.exports = { createAuthRoutes };
