const express = require('express');
const { asyncHandler } = require('../utils/async-handler');

function createAccountRoutes(controller, requireSession, requireSameOrigin) {
    const router = express.Router();
    router.get('/api/users/me/account', requireSession, asyncHandler(controller.show));
    router.patch('/api/users/me/account', requireSameOrigin, requireSession, asyncHandler(controller.update));
    router.get('/api/users/me/context', requireSession, asyncHandler(controller.context));
    return router;
}

module.exports = { createAccountRoutes };
