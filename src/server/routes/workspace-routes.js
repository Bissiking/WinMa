const express = require('express');
const { asyncHandler } = require('../utils/async-handler');

function createWorkspaceRoutes(workspaceController, requireSession, requireSameOrigin) {
    const router = express.Router();
    router.get('/api/users/me/workspaces', requireSession, asyncHandler(workspaceController.index));
    router.post('/api/users/me/workspaces', requireSameOrigin, requireSession, asyncHandler(workspaceController.create));
    router.patch('/api/users/me/workspaces/:id', requireSameOrigin, requireSession, asyncHandler(workspaceController.rename));
    router.put('/api/users/me/workspaces/:id', requireSameOrigin, requireSession, asyncHandler(workspaceController.saveLayout));
    router.post('/api/users/me/workspaces/:id/activate', requireSameOrigin, requireSession, asyncHandler(workspaceController.activate));
    router.delete('/api/users/me/workspaces/:id', requireSameOrigin, requireSession, asyncHandler(workspaceController.remove));
    return router;
}

module.exports = { createWorkspaceRoutes };
