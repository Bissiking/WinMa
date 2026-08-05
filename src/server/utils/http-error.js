// src/server/utils/http-error.js
class HttpError extends Error {
    constructor(status, code, message, options = {}) {
        super(message, options);
        this.name = 'HttpError';
        this.status = status;
        this.code = code;
        this.expose = status < 500;
    }
}

module.exports = { HttpError };
