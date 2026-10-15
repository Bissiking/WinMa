const express = require('express');
const { asyncHandler } = require('../utils/async-handler');

function createWindowSessionRoutes(windowSessionController, requireSession, requireSameOrigin) {
    const router = express.Router();
    router.get('/api/users/me/windows', requireSession, asyncHandler(windowSessionController.show));
    router.put(
        '/api/users/me/windows',
        requireSameOrigin,
        requireSession,
        asyncHandler(windowSessionController.update)
    );
    router.delete(
        '/api/users/me/windows',
        requireSameOrigin,
        requireSession,
        asyncHandler(windowSessionController.clear)
    );
    return router;
}

module.exports = { createWindowSessionRoutes };
