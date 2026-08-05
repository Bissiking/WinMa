// src/server/utils/async-handler.js
function asyncHandler(handler) {
    return function wrappedHandler(req, res, next) {
        Promise.resolve(handler(req, res, next)).catch(next);
    };
}

module.exports = { asyncHandler };
