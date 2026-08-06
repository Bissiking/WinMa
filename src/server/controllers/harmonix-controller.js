const { Readable } = require('node:stream');
const { sendSuccess } = require('../utils/api-response');

function pipeUpstream(response, res, passthroughHeaders) {
    res.status(response.status);
    for (const header of passthroughHeaders) {
        const value = response.headers.get(header);
        if (value) res.setHeader(header, value);
    }
    if (!response.body) return res.end();
    return Readable.fromWeb(response.body).pipe(res);
}

function createHarmonixController(harmonixService) {
    return {
        async listTracks(req, res) {
            return sendSuccess(res, { tracks: await harmonixService.listTracks() });
        },
        async streamTrack(req, res) {
            const response = await harmonixService.getStream(req.params.trackId, req.headers.range);
            return pipeUpstream(response, res, harmonixService.passthroughHeaders);
        },
        async showCover(req, res) {
            const response = await harmonixService.getCover(req.params.coverName);
            return pipeUpstream(response, res, harmonixService.passthroughHeaders);
        }
    };
}

module.exports = { createHarmonixController };
