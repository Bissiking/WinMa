import { requestJson, patchJson, postJson, putJson } from "/assets/javascripts/luma-api.js";

const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const rows = (payload) => Array.isArray(payload) ? payload : payload?.items || payload?.tracks || payload?.albums || payload?.playlists || payload?.roles || payload?.results || payload?.data || [];
const collectionId = (item) => String(item?.id || item?.uuid || "");

function duration(value) {
    const seconds = Number(value?.duration ?? value?.duration_seconds ?? 0);
    if (!Number.isFinite(seconds) || seconds <= 0) return "—";
    return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function renderShell(root) {
    root.innerHTML = `
        <div class="sonora-studio" data-view="tracks">
            <aside class="sonora-sidebar">
                <div class="sonora-brand"><img src="/images/interface-logo/applications/sonora-studio.svg" alt=""><span><strong>Sonora</strong><small>Studio</small></span></div>
                <nav aria-label="Sections de Sonora Studio">
                    <button class="is-current" type="button" data-view="tracks">${icon("music")}<span>Catalogue</span></button>
                    <button type="button" data-view="albums">${icon("folder")}<span>Albums</span></button>
                    <button type="button" data-view="playlists">${icon("notepad")}<span>Playlists</span></button>
                    <button type="button" data-view="import">${icon("plus")}<span>Importer</span></button>
                    <button type="button" data-view="users" data-access-nav hidden>${icon("user")}<span>Utilisateurs</span></button>
                </nav>
                <div class="sonora-connection"><i></i><span><strong data-connection-label>Connexion…</strong><small>Sonora API v5</small></span></div>
            </aside>
            <main class="sonora-main">
                <header class="sonora-header">
                    <div><p>Bibliothèque audio LUMA</p><h1 data-title>Catalogue</h1></div>
                    <div class="sonora-header__actions">
                        <label class="sonora-search">${icon("search")}<span class="sr-only">Rechercher</span><input type="search" placeholder="Titre, artiste ou album"></label>
                        <button class="sonora-primary" type="button" data-action="open-import">${icon("plus")}<span>Importer</span></button>
                    </div>
                </header>
                <section class="sonora-content" aria-live="polite"></section>
            </main>
            <dialog class="sonora-dialog"><form method="dialog"><div data-dialog-body></div></form></dialog>
        </div>`;
}

function normalizeTrack(track) {
    return {
        ...track,
        id: track.id || track.uuid,
        title: track.title || track.name || "Sans titre",
        artist: track.artist || track.artist_name || "Artiste inconnu",
        album: typeof track.album === "string" ? track.album : track.album?.title || track.album_name || "—",
        visibility: track.visibility || "private"
    };
}

export async function mount(root, { toast }) {
    const state = {
        view: "tracks", query: "", visibility: "all", tracks: [], albums: [], playlists: [], roles: [],
        selected: new Set(), identity: null, authenticated: false, collection: null, userAccess: null
    };
    renderShell(root);
    const shell = root.querySelector(".sonora-studio");
    const content = root.querySelector(".sonora-content");
    const searchField = root.querySelector(".sonora-search");
    const search = searchField.querySelector("input");
    const importButton = root.querySelector(".sonora-header [data-action=open-import]");
    const dialog = root.querySelector(".sonora-dialog");
    let searchTimer;

    const can = (permission) => Boolean(state.identity?.permissions?.some((granted) => granted === "*" || granted === permission || (granted.endsWith(":*") && permission.startsWith(granted.slice(0, -1)))));
    const itemTitle = (item, kind) => kind === "albums" ? item?.title : item?.name;

    function setView(view) {
        if (view === "users" && !can("roles:read")) return;
        state.view = view;
        state.collection = null;
        shell.dataset.view = view;
        root.querySelectorAll(".sonora-sidebar [data-view]").forEach((button) => button.classList.toggle("is-current", button.dataset.view === view));
        root.querySelector("[data-title]").textContent = ({ tracks: "Catalogue", albums: "Albums", playlists: "Playlists", import: "Importer une piste", users: "Droits utilisateurs" })[view];
        searchField.hidden = view !== "tracks";
        importButton.hidden = view === "import" || view === "users" || !can("tracks:create");
        render();
    }

    function renderTracks() {
        const visible = state.tracks.filter((track) => {
            const matchesQuery = `${track.title} ${track.artist} ${track.album} ${track.owner_id || ""}`.toLocaleLowerCase("fr").includes(state.query);
            return matchesQuery && (state.visibility === "all" || track.visibility === state.visibility);
        });
        const publicCount = state.tracks.filter((track) => track.visibility === "public").length;
        const privateCount = state.tracks.filter((track) => track.visibility === "private").length;
        const selectedCount = state.selected.size;
        content.innerHTML = `
            <div class="sonora-overview">
                <article><span>${icon("music")}</span><div><strong>${state.tracks.length}</strong><small>pistes</small></div></article>
                <article><span>${icon("check")}</span><div><strong>${publicCount}</strong><small>publiques</small></div></article>
                <article><span>${icon("user")}</span><div><strong>${privateCount}</strong><small>privées</small></div></article>
                <div class="sonora-wave" aria-hidden="true">${Array.from({ length: 28 }, (_, i) => `<i style="--h:${20 + ((i * 37) % 72)}%"></i>`).join("")}</div>
            </div>
            <section class="sonora-panel">
                <header><div><h2>Catalogue complet</h2><p>${visible.length} résultat${visible.length > 1 ? "s" : ""}, pistes privées incluses</p></div><div class="sonora-panel__tools"><div class="sonora-filter" aria-label="Filtrer par visibilité">${[["all", "Toutes"], ["public", "Publiques"], ["private", "Privées"]].map(([value, label]) => `<button class="${state.visibility === value ? "is-current" : ""}" type="button" data-visibility="${value}">${label}</button>`).join("")}</div><button type="button" data-action="reload" aria-label="Actualiser">${icon("sync")}</button></div></header>
                <div class="sonora-bulk" ${selectedCount ? "" : "hidden"}><strong>${selectedCount} sélectionnée${selectedCount > 1 ? "s" : ""}</strong><span>Modifier la visibilité sans changer le propriétaire.</span><div><button type="button" data-action="bulk-private">Rendre privées</button><button class="sonora-primary" type="button" data-action="bulk-public">${icon("check")}Publier</button></div></div>
                <div class="sonora-table-head"><label><input type="checkbox" data-action="select-visible" ${visible.length && visible.every((track) => state.selected.has(String(track.id))) ? "checked" : ""}><span class="sr-only">Sélectionner les pistes visibles</span></label><span>Titre</span><span>Propriétaire Kyros</span><span>Visibilité</span><span>Album</span><span>Durée</span><span></span></div>
                <div class="sonora-track-list">${visible.length ? visible.map((track, index) => `
                    <article class="sonora-track" data-track-id="${escapeHtml(track.id)}">
                        <label><input type="checkbox" data-select-track="${escapeHtml(track.id)}" ${state.selected.has(String(track.id)) ? "checked" : ""}><span class="sr-only">Sélectionner ${escapeHtml(track.title)}</span></label>
                        <div class="sonora-track__identity"><span class="sonora-track__number">${String(index + 1).padStart(2, "0")}</span><span><strong>${escapeHtml(track.title)}</strong><small>${escapeHtml(track.artist)}</small></span></div>
                        <span class="sonora-owner ${track.owner_id === "anonymous" ? "is-anonymous" : ""}" title="${escapeHtml(track.owner_id || "Propriétaire inconnu")}">${escapeHtml(track.owner_id || "—")}</span><span class="sonora-status sonora-status--${escapeHtml(track.visibility)}">${track.visibility === "public" ? "Publique" : "Privée"}</span><span>${escapeHtml(track.album)}</span><span>${duration(track)}</span>
                        <button type="button" data-action="edit-track" aria-label="Modifier ${escapeHtml(track.title)}">•••</button>
                    </article>`).join("") : `<div class="sonora-empty">${icon("music")}<h2>${state.query ? "Aucune piste trouvée" : "Votre catalogue est vide"}</h2><p>${state.query ? "Essayez une recherche plus courte." : "Importez un fichier audio pour commencer."}</p>${can("tracks:create") ? `<button class="sonora-primary" type="button" data-action="open-import">Importer une piste</button>` : ""}</div>`}</div>
            </section>`;
    }

    function renderCollection(kind) {
        const items = state[kind];
        const singular = kind === "albums" ? "album" : "playlist";
        const canCreate = can(kind === "albums" ? "albums:create" : "playlists:own");
        content.innerHTML = `<section class="sonora-collection-intro"><div><span>${icon(kind === "albums" ? "folder" : "notepad")}</span><h2>Organisez votre musique</h2><p>${kind === "albums" ? "Regroupez les pistes par projet et maîtrisez leur ordre de lecture." : "Composez des sélections pour chaque contexte d’écoute."}</p></div>${canCreate ? `<button class="sonora-primary" type="button" data-action="create-${singular}">${icon("plus")}Créer ${singular === "album" ? "un album" : "une playlist"}</button>` : ""}</section>
        <div class="sonora-card-grid">${items.length ? items.map((item) => `<button class="sonora-card" type="button" data-action="open-collection" data-kind="${kind}" data-item-id="${escapeHtml(collectionId(item))}"><span class="sonora-card__art">${icon(kind === "albums" ? "music" : "notepad")}</span><span class="sonora-card__copy"><small>${kind === "albums" ? "ALBUM" : "PLAYLIST"}</small><strong>${escapeHtml(itemTitle(item, kind) || "Sans titre")}</strong><span>${escapeHtml(item.artist || item.description || "Aucune description")}</span><em>${Number(item.track_count || 0)} morceau${Number(item.track_count || 0) > 1 ? "x" : ""}</em></span><span class="sonora-visibility">${escapeHtml(item.visibility || "private")}</span></button>`).join("") : `<div class="sonora-empty sonora-empty--wide"><h2>Aucun ${singular}</h2><p>Créez votre premier ${singular} depuis Sonora Studio.</p></div>`}</div>`;
    }

    function renderCollectionEditor() {
        const { kind, detail, trackIds } = state.collection;
        const album = kind === "albums";
        const title = itemTitle(detail, kind) || "Sans titre";
        const selectedTracks = trackIds.map((id) => state.tracks.find((track) => String(track.id) === String(id)) || rows(detail).map(normalizeTrack).find((track) => String(track.id) === String(id))).filter(Boolean);
        const available = state.tracks.filter((track) => !trackIds.includes(String(track.id)));
        const canEdit = can(album ? "albums:update" : "playlists:own");
        content.innerHTML = `<div class="sonora-editor">
            <div class="sonora-editor__top"><button type="button" data-action="close-collection">${icon("previous")}Retour aux ${album ? "albums" : "playlists"}</button><span class="sonora-status sonora-status--${escapeHtml(detail.visibility || "private")}">${detail.visibility === "public" ? "Publique" : "Privée"}</span></div>
            <section class="sonora-editor__meta">
                <div class="sonora-editor__art">${icon(album ? "music" : "notepad")}</div>
                <form data-form="collection-meta"><div><h2>${escapeHtml(title)}</h2><p>${selectedTracks.length} morceau${selectedTracks.length > 1 ? "x" : ""} dans cette ${album ? "édition" : "sélection"}</p></div>
                    <label>${album ? "Titre" : "Nom"}<input name="${album ? "title" : "name"}" value="${escapeHtml(title)}" required ${canEdit ? "" : "disabled"}></label>
                    <label>${album ? "Artiste" : "Description"}<input name="${album ? "artist" : "description"}" value="${escapeHtml(album ? detail.artist || "" : detail.description || "")}" ${canEdit ? "" : "disabled"}></label>
                    <label>Visibilité<select name="visibility" ${canEdit ? "" : "disabled"}><option value="private" ${detail.visibility !== "public" ? "selected" : ""}>Privée</option><option value="public" ${detail.visibility === "public" ? "selected" : ""}>Publique</option></select></label>
                    <button class="sonora-primary" type="submit" ${canEdit ? "" : "disabled"}>Enregistrer les informations</button>
                </form>
            </section>
            <section class="sonora-sequencer">
                <header><div><h2>Ordre de lecture</h2><p>Ajoutez, retirez ou déplacez les morceaux. L’ordre n’est appliqué qu’après enregistrement.</p></div><button class="sonora-primary" type="button" data-action="save-collection-tracks" ${canEdit ? "" : "disabled"}>Enregistrer l’ordre</button></header>
                <div class="sonora-add-track"><label for="sonora-track-picker">Ajouter depuis le catalogue</label><div><select id="sonora-track-picker" ${available.length && canEdit ? "" : "disabled"}>${available.length ? available.map((track) => `<option value="${escapeHtml(track.id)}">${escapeHtml(track.title)} — ${escapeHtml(track.artist)}</option>`).join("") : `<option>Tous les morceaux sont déjà ajoutés</option>`}</select><button type="button" data-action="add-collection-track" ${available.length && canEdit ? "" : "disabled"}>${icon("plus")}Ajouter</button></div></div>
                <ol class="sonora-sequence">${selectedTracks.length ? selectedTracks.map((track, index) => `<li><span class="sonora-track__number">${String(index + 1).padStart(2, "0")}</span><span><strong>${escapeHtml(track.title)}</strong><small>${escapeHtml(track.artist)} · ${duration(track)}</small></span><div><button type="button" data-action="move-track-up" data-track-id="${escapeHtml(track.id)}" ${index === 0 || !canEdit ? "disabled" : ""} aria-label="Monter ${escapeHtml(track.title)}">${icon("chevron")}</button><button type="button" data-action="move-track-down" data-track-id="${escapeHtml(track.id)}" ${index === selectedTracks.length - 1 || !canEdit ? "disabled" : ""} aria-label="Descendre ${escapeHtml(track.title)}">${icon("chevron")}</button><button class="sonora-remove" type="button" data-action="remove-collection-track" data-track-id="${escapeHtml(track.id)}" ${canEdit ? "" : "disabled"}>Retirer</button></div></li>`).join("") : `<li class="sonora-sequence__empty">Aucun morceau. Ajoutez-en un depuis le catalogue.</li>`}</ol>
            </section>
        </div>`;
    }

    function renderUsers() {
        if (!can("roles:read")) {
            content.innerHTML = `<div class="sonora-offline"><span>${icon("user")}</span><h2>Accès administrateur requis</h2><p>La permission Sonora <code>roles:read</code> est nécessaire pour consulter les droits.</p></div>`;
            return;
        }
        const canManage = can("roles:manage");
        const assigned = new Set(rows(state.userAccess).map((role) => String(role.id)));
        content.innerHTML = `<div class="sonora-access">
            <section class="sonora-access__intro"><div><span>${icon("user")}</span><div><h2>Accès à Sonora</h2><p>Chargez un identifiant Kyros puis affectez un ou plusieurs rôles. Les permissions sont contrôlées par Sonora, jamais par le navigateur.</p></div></div><form data-form="lookup-user"><label for="sonora-user-id">Identifiant Kyros</label><div><input id="sonora-user-id" name="userId" value="${escapeHtml(state.userAccess?.userId || state.identity?.id || "")}" placeholder="sub Kyros" required><button class="sonora-primary" type="submit">Charger les droits</button></div></form></section>
            ${state.userAccess ? `<section class="sonora-role-panel"><header><div><h2>${escapeHtml(state.userAccess.userId)}</h2><p>${assigned.size ? `${assigned.size} rôle${assigned.size > 1 ? "s" : ""} actuellement affecté${assigned.size > 1 ? "s" : ""}` : "Aucun rôle affecté"}</p></div><button class="sonora-primary" type="button" data-action="save-user-roles" ${canManage ? "" : "disabled"}>Enregistrer les droits</button></header><div class="sonora-role-list">${state.roles.map((role) => `<label class="sonora-role"><input type="checkbox" value="${escapeHtml(role.id)}" ${assigned.has(String(role.id)) ? "checked" : ""} ${canManage ? "" : "disabled"}><span><strong>${escapeHtml(role.name || role.id)}</strong><small>${escapeHtml(role.description || "Rôle personnalisé")}</small><em>${(role.permissions || []).slice(0, 4).map(escapeHtml).join(" · ")}${(role.permissions || []).length > 4 ? "…" : ""}</em></span>${role.system ? `<b>Système</b>` : ""}</label>`).join("")}</div>${!canManage ? `<p class="sonora-access__notice">Votre compte peut consulter les rôles, mais la permission <code>roles:manage</code> est requise pour les modifier.</p>` : ""}</section>` : `<div class="sonora-access__empty">${icon("user")}<h2>Sélectionnez un utilisateur</h2><p>Sonora ne conserve que son identifiant Kyros et les rôles qui lui sont affectés.</p></div>`}
        </div>`;
    }

    function renderImport() {
        const canUpload = can("tracks:create");
        content.innerHTML = `<section class="sonora-import-card"><div class="sonora-drop-mark">${icon("music")}<i></i></div><div><h2>Déposez le prochain morceau<br>de votre catalogue.</h2><p>Sonora génère automatiquement les qualités d’écoute et peut détecter le BPM pendant l’import.</p><div class="sonora-actor ${canUpload ? "is-authorized" : ""}"><span>${icon(canUpload ? "check" : "user")}</span><div><strong>${canUpload ? `Import attribué à ${escapeHtml(state.identity.username || state.identity.id)}` : "Import non autorisé"}</strong><small>${canUpload ? `owner_id sera défini depuis le sub Kyros : ${escapeHtml(state.identity.id)}` : "La permission Sonora tracks:create est requise."}</small></div></div></div><form class="sonora-import-form"><label class="sonora-file"><input type="file" name="file" accept="audio/*" required ${canUpload ? "" : "disabled"}><span>${icon("plus")}<strong>Choisir un fichier audio</strong><small>MP3, WAV, FLAC, AAC…</small></span></label><div class="sonora-form-grid"><label>Titre<input name="title" maxlength="180" ${canUpload ? "" : "disabled"}></label><label>Artiste<input name="artist" maxlength="180" ${canUpload ? "" : "disabled"}></label><label>Album<input name="album" maxlength="180" ${canUpload ? "" : "disabled"}></label><label>Genres<input name="genres" placeholder="Ambient; Électronique" ${canUpload ? "" : "disabled"}></label><label>Visibilité<select name="visibility" ${canUpload ? "" : "disabled"}><option value="private">Privée</option><option value="public">Publique</option></select></label><label class="sonora-check"><input type="checkbox" name="detect_bpm" checked ${canUpload ? "" : "disabled"}><span>Détecter le BPM</span></label></div><button class="sonora-primary sonora-submit" type="submit" ${canUpload ? "" : "disabled"}>Lancer l’import</button></form></section>`;
        const file = content.querySelector('input[type="file"]');
        file.addEventListener("change", () => { if (file.files[0]) content.querySelector(".sonora-file strong").textContent = file.files[0].name; });
        content.querySelector(".sonora-import-form").addEventListener("submit", upload);
    }

    function render() {
        if (!state.authenticated) content.innerHTML = `<div class="sonora-offline"><span>${icon("music")}</span><h2>Reconnectez votre compte Kyros</h2><p>Sonora Studio utilise l’identité Kyros de votre session Luma OS. Aucun token n’est conservé dans l’application ou exposé au navigateur.</p></div>`;
        else if (state.collection) renderCollectionEditor();
        else if (state.view === "tracks") renderTracks();
        else if (state.view === "albums" || state.view === "playlists") renderCollection(state.view);
        else if (state.view === "users") renderUsers();
        else renderImport();
    }

    function promptForm({ title, fields, confirm = "Créer" }) {
        dialog.querySelector("[data-dialog-body]").innerHTML = `<h2>${escapeHtml(title)}</h2>${fields.map((field) => `<label>${escapeHtml(field.label)}${field.type === "textarea" ? `<textarea name="${field.name}" maxlength="500"></textarea>` : `<input name="${field.name}" value="${escapeHtml(field.value || "")}" ${field.required ? "required" : ""} maxlength="180">`}</label>`).join("")}<div class="sonora-dialog__actions"><button value="cancel">Annuler</button><button class="sonora-primary" value="confirm">${escapeHtml(confirm)}</button></div>`;
        dialog.showModal();
        dialog.querySelector("input, textarea")?.focus();
        return new Promise((resolve) => dialog.addEventListener("close", () => {
            if (dialog.returnValue !== "confirm") return resolve(null);
            resolve(Object.fromEntries(new FormData(dialog.querySelector("form"))));
        }, { once: true }));
    }

    async function createCollection(kind) {
        const album = kind === "album";
        const values = await promptForm({ title: album ? "Nouvel album" : "Nouvelle playlist", fields: album ? [{ name: "title", label: "Titre", required: true }, { name: "artist", label: "Artiste" }] : [{ name: "name", label: "Nom", required: true }, { name: "description", label: "Description", type: "textarea" }] });
        if (!values) return;
        await postJson(`/api/sonora-studio/${album ? "albums" : "playlists"}`, { ...values, visibility: "private" });
        toast?.(`${album ? "Album" : "Playlist"} créé${album ? "" : "e"}.`);
        await loadCollections(); render();
    }

    async function openCollection(kind, id) {
        const detail = await requestJson(`/api/sonora-studio/${kind}/${encodeURIComponent(id)}`);
        state.collection = { kind, detail, trackIds: rows(detail).map((track) => String(track.id || track.uuid)) };
        root.querySelector("[data-title]").textContent = itemTitle(detail, kind) || (kind === "albums" ? "Album" : "Playlist");
        render();
    }

    async function saveCollectionMeta(form) {
        const { kind, detail } = state.collection;
        const values = Object.fromEntries(new FormData(form));
        await patchJson(`/api/sonora-studio/${kind}/${encodeURIComponent(collectionId(detail))}`, values);
        toast?.("Informations enregistrées.");
        await Promise.all([loadCollections(), openCollection(kind, collectionId(detail))]);
    }

    async function saveCollectionTracks() {
        const { kind, detail, trackIds } = state.collection;
        await putJson(`/api/sonora-studio/${kind}/${encodeURIComponent(collectionId(detail))}/tracks`, { track_ids: trackIds });
        toast?.(`Ordre des ${trackIds.length} morceau${trackIds.length > 1 ? "x" : ""} enregistré.`);
        await Promise.all([loadTracks(), loadCollections()]);
        await openCollection(kind, collectionId(detail));
    }

    async function loadUserRoles(userId) {
        const roles = await requestJson(`/api/sonora-studio/access/users/${encodeURIComponent(userId)}/roles`);
        state.userAccess = { userId, roles: rows(roles) };
        render();
    }

    async function saveUserRoles() {
        const roleIds = [...content.querySelectorAll(".sonora-role input:checked")].map((input) => input.value);
        await putJson(`/api/sonora-studio/access/users/${encodeURIComponent(state.userAccess.userId)}/roles`, { role_ids: roleIds });
        toast?.("Droits utilisateur enregistrés.");
        await loadUserRoles(state.userAccess.userId);
    }

    async function editTrack(id) {
        const track = state.tracks.find((item) => String(item.id) === String(id));
        const values = await promptForm({ title: "Modifier la piste", confirm: "Enregistrer", fields: [{ name: "title", label: "Titre", value: track.title, required: true }, { name: "artist", label: "Artiste", value: track.artist }, { name: "album", label: "Album", value: track.album === "—" ? "" : track.album }] });
        if (!values) return;
        await patchJson(`/api/sonora-studio/tracks/${encodeURIComponent(id)}`, values);
        toast?.("Piste mise à jour."); await loadTracks(); render();
    }

    async function upload(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const button = form.querySelector("button[type=submit]");
        button.disabled = true; button.textContent = "Import et transcodage…";
        try {
            const body = new FormData(form);
            body.set("detect_bpm", String(body.has("detect_bpm")));
            body.set("transcode", "true");
            const response = await fetch("/api/sonora-studio/upload", { method: "POST", credentials: "same-origin", headers: { accept: "application/json" }, body });
            const payload = await response.json().catch(() => ({}));
            if (!response.ok || payload.success === false) throw new Error(payload.message || "L’import a échoué.");
            toast?.("Piste importée dans Sonora."); await loadTracks(); setView("tracks");
        } catch (error) { toast?.(error.message); button.disabled = false; button.textContent = "Lancer l’import"; }
    }

    async function loadTracks() {
        const payload = await requestJson("/api/sonora-studio/tracks?limit=200");
        state.tracks = rows(payload).map(normalizeTrack);
        state.selected = new Set([...state.selected].filter((id) => state.tracks.some((track) => String(track.id) === id)));
    }

    async function loadCollections() {
        const requests = [];
        if (can("albums:read")) requests.push(requestJson("/api/sonora-studio/albums").then((payload) => { state.albums = rows(payload); }));
        if (can("playlists:read")) requests.push(requestJson("/api/sonora-studio/playlists").then((payload) => { state.playlists = rows(payload); }));
        await Promise.all(requests);
    }

    async function loadAll() {
        state.identity = await requestJson("/api/sonora-studio/me");
        root.querySelector("[data-access-nav]").hidden = !can("roles:read");
        const requests = [loadCollections()];
        if (can("tracks:update")) requests.push(loadTracks());
        if (can("roles:read")) requests.push(requestJson("/api/sonora-studio/access/roles").then((payload) => { state.roles = rows(payload); }));
        await Promise.all(requests);
    }

    async function setBulkVisibility(visibility) {
        if (!state.selected.size) return;
        const result = await patchJson("/api/sonora-studio/tracks/bulk-visibility", { ids: [...state.selected], visibility });
        toast?.(`${result?.updated ?? state.selected.size} piste${(result?.updated ?? state.selected.size) > 1 ? "s" : ""} ${visibility === "public" ? "publiée" : "rendue privée"}${(result?.updated ?? state.selected.size) > 1 ? "s" : ""}.`);
        state.selected.clear(); await loadTracks(); render();
    }

    const click = async (event) => {
        const view = event.target.closest(".sonora-sidebar [data-view]")?.dataset.view;
        const actionTarget = event.target.closest("[data-action]");
        const action = actionTarget?.dataset.action;
        const visibility = event.target.closest("[data-visibility]")?.dataset.visibility;
        const selectedTrack = event.target.closest("[data-select-track]")?.dataset.selectTrack;
        try {
            if (view) setView(view);
            else if (visibility) { state.visibility = visibility; render(); }
            else if (selectedTrack) { event.target.checked ? state.selected.add(selectedTrack) : state.selected.delete(selectedTrack); render(); }
            else if (action === "select-visible") {
                const visible = state.tracks.filter((track) => (state.visibility === "all" || track.visibility === state.visibility) && `${track.title} ${track.artist} ${track.album} ${track.owner_id || ""}`.toLocaleLowerCase("fr").includes(state.query));
                visible.forEach((track) => event.target.checked ? state.selected.add(String(track.id)) : state.selected.delete(String(track.id))); render();
            } else if (action === "open-import") setView("import");
            else if (action === "reload") { await loadAll(); render(); toast?.("Catalogue actualisé."); }
            else if (action === "create-album") await createCollection("album");
            else if (action === "create-playlist") await createCollection("playlist");
            else if (action === "bulk-public") await setBulkVisibility("public");
            else if (action === "bulk-private") await setBulkVisibility("private");
            else if (action === "edit-track") await editTrack(actionTarget.closest("[data-track-id]").dataset.trackId);
            else if (action === "open-collection") await openCollection(actionTarget.dataset.kind, actionTarget.dataset.itemId);
            else if (action === "close-collection") setView(state.collection.kind);
            else if (action === "add-collection-track") {
                const id = content.querySelector("#sonora-track-picker").value;
                if (id) state.collection.trackIds.push(String(id)); render();
            } else if (action === "remove-collection-track") { state.collection.trackIds = state.collection.trackIds.filter((id) => id !== actionTarget.dataset.trackId); render(); }
            else if (action === "move-track-up" || action === "move-track-down") {
                const index = state.collection.trackIds.indexOf(actionTarget.dataset.trackId);
                const next = index + (action === "move-track-up" ? -1 : 1);
                [state.collection.trackIds[index], state.collection.trackIds[next]] = [state.collection.trackIds[next], state.collection.trackIds[index]]; render();
            } else if (action === "save-collection-tracks") await saveCollectionTracks();
            else if (action === "save-user-roles") await saveUserRoles();
        } catch (error) { toast?.(error.message); }
    };

    const submit = async (event) => {
        const form = event.target.closest("[data-form]");
        if (!form) return;
        event.preventDefault();
        try {
            if (form.dataset.form === "lookup-user") await loadUserRoles(new FormData(form).get("userId").trim());
            else if (form.dataset.form === "collection-meta") await saveCollectionMeta(form);
        } catch (error) { toast?.(error.message); }
    };

    const input = () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.query = search.value.trim().toLocaleLowerCase("fr"); render(); }, 180); };
    root.addEventListener("click", click); root.addEventListener("submit", submit); search.addEventListener("input", input);

    try {
        const status = await requestJson("/api/sonora-studio/status");
        state.authenticated = status.authenticated;
        root.querySelector("[data-connection-label]").textContent = status.authenticated ? "Session Kyros active" : "Session requise";
        shell.classList.toggle("is-connected", status.authenticated);
        if (status.authenticated) await loadAll();
    } catch (error) { root.querySelector("[data-connection-label]").textContent = "Indisponible"; toast?.(error.message); }
    setView("tracks");
    return () => { clearTimeout(searchTimer); root.removeEventListener("click", click); root.removeEventListener("submit", submit); search.removeEventListener("input", input); };
}
