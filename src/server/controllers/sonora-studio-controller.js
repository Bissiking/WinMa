const { sendSuccess } = require('../utils/api-response');

function createSonoraStudioController(service) {
    const accessToken = (req) => req.session?.kyros?.accessToken;
    return {
        status: async (req, res) => sendSuccess(res, service.status(accessToken(req))),
        identity: async (req, res) => sendSuccess(res, await service.getIdentity(accessToken(req))),
        tracks: async (req, res) => sendSuccess(res, await service.listTracks(accessToken(req), req.query)),
        albums: async (req, res) => sendSuccess(res, await service.listAlbums(accessToken(req))),
        album: async (req, res) => sendSuccess(res, await service.getAlbum(accessToken(req), req.params.id)),
        createAlbum: async (req, res) => sendSuccess(res, await service.createAlbum(accessToken(req), req.body), 'Album créé.', 201),
        updateAlbum: async (req, res) => sendSuccess(res, await service.updateAlbum(accessToken(req), req.params.id, req.body), 'Album modifié.'),
        setAlbumTracks: async (req, res) => sendSuccess(res, await service.setAlbumTracks(accessToken(req), req.params.id, req.body), 'Morceaux de l’album enregistrés.'),
        deleteAlbum: async (req, res) => sendSuccess(res, await service.deleteAlbum(accessToken(req), req.params.id), 'Album supprimé.'),
        playlists: async (req, res) => sendSuccess(res, await service.listPlaylists(accessToken(req))),
        playlist: async (req, res) => sendSuccess(res, await service.getPlaylist(accessToken(req), req.params.id)),
        createPlaylist: async (req, res) => sendSuccess(res, await service.createPlaylist(accessToken(req), req.body), 'Playlist créée.', 201),
        updatePlaylist: async (req, res) => sendSuccess(res, await service.updatePlaylist(accessToken(req), req.params.id, req.body), 'Playlist modifiée.'),
        setPlaylistTracks: async (req, res) => sendSuccess(res, await service.setPlaylistTracks(accessToken(req), req.params.id, req.body), 'Morceaux de la playlist enregistrés.'),
        deletePlaylist: async (req, res) => sendSuccess(res, await service.deletePlaylist(accessToken(req), req.params.id), 'Playlist supprimée.'),
        roles: async (req, res) => sendSuccess(res, await service.listRoles(accessToken(req))),
        userRoles: async (req, res) => sendSuccess(res, await service.getUserRoles(accessToken(req), req.params.userId)),
        setUserRoles: async (req, res) => sendSuccess(res, await service.setUserRoles(accessToken(req), req.params.userId, req.body), 'Droits utilisateur enregistrés.'),
        updateTrack: async (req, res) => sendSuccess(res, await service.updateTrack(accessToken(req), req.params.id, req.body), 'Piste modifiée.'),
        bulkTrackVisibility: async (req, res) => sendSuccess(res, await service.bulkTrackVisibility(accessToken(req), req.body), 'Visibilité mise à jour.'),
        deleteTrack: async (req, res) => sendSuccess(res, await service.deleteTrack(accessToken(req), req.params.id, req.query.deleteFile === 'true'), 'Piste supprimée.'),
        uploadTrack: async (req, res) => sendSuccess(res, await service.uploadTrack(accessToken(req), req.file, req.body), 'Piste importée.', 201)
    };
}

module.exports = { createSonoraStudioController };
