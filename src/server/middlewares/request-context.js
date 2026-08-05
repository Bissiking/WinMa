// src/server/middlewares/request-context.js
const crypto = require('node:crypto');

function requestContext(req, res, next) {
    req.id = crypto.randomUUID();
    res.setHeader('X-Request-Id', req.id);
    next();
}

module.exports = { requestContext };
