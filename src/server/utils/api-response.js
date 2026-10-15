// src/server/utils/api-response.js
function sendSuccess(res, data = null, message = null, status = 200) {
    return res.status(status).json({ success: true, data, message });
}

function sendError(res, message, code = 'INTERNAL_ERROR', status = 500) {
    return res.status(status).json({ success: false, data: null, message, code });
}

module.exports = { sendSuccess, sendError };
