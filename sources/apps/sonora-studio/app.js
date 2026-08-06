import { requestJson, patchJson, postJson } from "/assets/javascripts/luma-api.js";

const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const rows = (payload) => Array.isArray(payload) ? payload : payload?.items || payload?.tracks || payload?.albums || payload?.playlists || payload?.results || payload?.data || [];

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
    const state = { view: "tracks", query: "", visibility: "all", tracks: [], albums: [], playlists: [], selected: new Set(), identity: null, authenticated: false };
    renderShell(root);
    const shell = root.querySelector(".sonora-studio");
    const content = root.querySelector(".sonora-content");
    const search = root.querySelector(".sonora-search input");
    const dialog = root.querySelector(".sonora-dialog");
    let searchTimer;

    function setView(view) {
        state.view = view;
        shell.dataset.view = view;
        root.querySelectorAll("[data-view]").forEach((button) => button.classList.toggle("is-current", button.dataset.view === view));
        root.querySelector("[data-title]").textContent = ({ tracks: "Catalogue", albums: "Albums", playlists: "Playlists", import: "Importer une piste" })[view];
        search.hidden = view !== "tracks";
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
                <header><div><h2>Catalogue complet</h2><p>${visible.length} résultat${visible.length > 1 ? "s" : ""}, pistes privées incluses</p></div><div class="sonora-panel__tools"><div class="sonora-filter" aria-label="Filtrer par visibilité">${[ ["all", "Toutes"], ["public", "Publiques"], ["private", "Privées"] ].map(([value, label]) => `<button class="${state.visibility === value ? "is-current" : ""}" type="button" data-visibility="${value}">${label}</button>`).join("")}</div><button type="button" data-action="reload" aria-label="Actualiser">${icon("sync")}</button></div></header>
                <div class="sonora-bulk" ${selectedCount ? "" : "hidden"}><strong>${selectedCount} sélectionnée${selectedCount > 1 ? "s" : ""}</strong><span>Modifier la visibilité sans changer le propriétaire.</span><div><button type="button" data-action="bulk-private">Rendre privées</button><button class="sonora-primary" type="button" data-action="bulk-public">${icon("check")}Publier</button></div></div>
                <div class="sonora-table-head"><label><input type="checkbox" data-action="select-visible" ${visible.length && visible.every((track) => state.selected.has(String(track.id))) ? "checked" : ""}><span class="sr-only">Sélectionner les pistes visibles</span></label><span>Titre</span><span>Propriétaire Kyros</span><span>Visibilité</span><span>Album</span><span>Durée</span><span></span></div>
                <div class="sonora-track-list">${visible.length ? visible.map((track, index) => `
                    <article class="sonora-track" data-track-id="${escapeHtml(track.id)}">
                        <label><input type="checkbox" data-select-track="${escapeHtml(track.id)}" ${state.selected.has(String(track.id)) ? "checked" : ""}><span class="sr-only">Sélectionner ${escapeHtml(track.title)}</span></label>
                        <div class="sonora-track__identity"><span class="sonora-track__number">${String(index + 1).padStart(2, "0")}</span><span><strong>${escapeHtml(track.title)}</strong><small>${escapeHtml(track.artist)}</small></span></div>
                        <span class="sonora-owner ${track.owner_id === "anonymous" ? "is-anonymous" : ""}" title="${escapeHtml(track.owner_id || "Propriétaire inconnu")}">${escapeHtml(track.owner_id || "—")}</span><span class="sonora-status sonora-status--${escapeHtml(track.visibility)}">${track.visibility === "public" ? "Publique" : "Privée"}</span><span>${escapeHtml(track.album)}</span><span>${duration(track)}</span>
                        <button type="button" data-action="edit-track" aria-label="Modifier ${escapeHtml(track.title)}">•••</button>
                    </article>`).join("") : `<div class="sonora-empty">${icon("music")}<h2>${state.query ? "Aucune piste trouvée" : "Votre catalogue est vide"}</h2><p>${state.query ? "Essayez une recherche plus courte." : "Importez un fichier audio pour commencer."}</p><button class="sonora-primary" type="button" data-action="open-import">Importer une piste</button></div>`}</div>
            </section>`;
    }

    function renderCollection(kind) {
        const items = state[kind];
        const singular = kind === "albums" ? "album" : "playlist";
        content.innerHTML = `<section class="sonora-collection-intro"><div><span>${icon(kind === "albums" ? "folder" : "notepad")}</span><h2>Organisez votre musique</h2><p>${kind === "albums" ? "Regroupez les pistes par projet et maîtrisez leur ordre de lecture." : "Composez des sélections pour chaque contexte d’écoute."}</p></div><button class="sonora-primary" type="button" data-action="create-${singular}">${icon("plus")}Créer ${singular === "album" ? "un album" : "une playlist"}</button></section>
        <div class="sonora-card-grid">${items.length ? items.map((item) => `<article class="sonora-card" data-item-id="${escapeHtml(item.id || item.uuid)}"><span class="sonora-card__art">${icon(kind === "albums" ? "music" : "notepad")}</span><div><small>${kind === "albums" ? "ALBUM" : "PLAYLIST"}</small><h3>${escapeHtml(item.title || item.name || "Sans titre")}</h3><p>${escapeHtml(item.artist || item.description || "Aucune description")}</p></div><span class="sonora-visibility">${escapeHtml(item.visibility || "private")}</span></article>`).join("") : `<div class="sonora-empty sonora-empty--wide"><h2>Aucun ${singular}</h2><p>Créez votre premier ${singular} depuis Sonora Studio.</p></div>`}</div>`;
    }

    function renderImport() {
        const canUpload = state.identity?.permissions?.includes("tracks:create");
        content.innerHTML = `<section class="sonora-import-card"><div class="sonora-drop-mark">${icon("music")}<i></i></div><div><p class="sonora-kicker">NOUVELLE PISTE</p><h2>Déposez le prochain morceau<br>de votre catalogue.</h2><p>Sonora génère automatiquement les qualités d’écoute et peut détecter le BPM pendant l’import.</p><div class="sonora-actor ${canUpload ? "is-authorized" : ""}"><span>${icon(canUpload ? "check" : "user")}</span><div><strong>${canUpload ? `Import attribué à ${escapeHtml(state.identity.username || state.identity.id)}` : "Import non autorisé"}</strong><small>${canUpload ? `owner_id sera défini depuis le sub Kyros : ${escapeHtml(state.identity.id)}` : "La permission Sonora tracks:create est requise."}</small></div></div></div><form class="sonora-import-form"><label class="sonora-file"><input type="file" name="file" accept="audio/*" required ${canUpload ? "" : "disabled"}><span>${icon("plus")}<strong>Choisir un fichier audio</strong><small>MP3, WAV, FLAC, AAC…</small></span></label><div class="sonora-form-grid"><label>Titre<input name="title" maxlength="180" ${canUpload ? "" : "disabled"}></label><label>Artiste<input name="artist" maxlength="180" ${canUpload ? "" : "disabled"}></label><label>Album<input name="album" maxlength="180" ${canUpload ? "" : "disabled"}></label><label>Genres<input name="genres" placeholder="Ambient; Électronique" ${canUpload ? "" : "disabled"}></label><label>Visibilité<select name="visibility" ${canUpload ? "" : "disabled"}><option value="private">Privée</option><option value="public">Publique</option></select></label><label class="sonora-check"><input type="checkbox" name="detect_bpm" checked ${canUpload ? "" : "disabled"}><span>Détecter le BPM</span></label></div><button class="sonora-primary sonora-submit" type="submit" ${canUpload ? "" : "disabled"}>Lancer l’import</button></form></section>`;
        const file = content.querySelector('input[type="file"]');
        file.addEventListener("change", () => { if (file.files[0]) content.querySelector(".sonora-file strong").textContent = file.files[0].name; });
        content.querySelector("form").addEventListener("submit", upload);
    }

    function render() {
        if (!state.authenticated) {
            content.innerHTML = `<div class="sonora-offline"><span>${icon("music")}</span><p class="sonora-kicker">SESSION REQUISE</p><h2>Reconnectez votre compte Kyros</h2><p>Sonora Studio utilise l’identité Kyros de votre session Luma OS. Aucun token n’est conservé dans l’application ou exposé au navigateur.</p></div>`;
        } else if (state.view === "tracks") renderTracks();
        else if (state.view === "albums" || state.view === "playlists") renderCollection(state.view);
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
            const identity = await requestJson("/api/sonora-studio/me");
            if (!identity?.id) throw new Error("Sonora n’a pas reçu votre identité Kyros.");
            if (!identity.permissions?.includes("tracks:create")) throw new Error("Votre compte ne possède pas la permission Sonora tracks:create.");
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
        const payload = await requestJson(`/api/sonora-studio/tracks?limit=200`);
        state.tracks = rows(payload).map(normalizeTrack);
        state.selected = new Set([...state.selected].filter((id) => state.tracks.some((track) => String(track.id) === id)));
    }
    async function loadCollections() {
        const [albums, playlists] = await Promise.all([requestJson("/api/sonora-studio/albums"), requestJson("/api/sonora-studio/playlists")]);
        state.albums = rows(albums); state.playlists = rows(playlists);
    }
    async function loadAll() {
        const [, , identity] = await Promise.all([loadTracks(), loadCollections(), requestJson("/api/sonora-studio/me")]);
        state.identity = identity;
    }

    async function setBulkVisibility(visibility) {
        if (!state.selected.size) return;
        const result = await patchJson("/api/sonora-studio/tracks/bulk-visibility", { ids: [...state.selected], visibility });
        toast?.(`${result?.updated ?? state.selected.size} piste${(result?.updated ?? state.selected.size) > 1 ? "s" : ""} ${visibility === "public" ? "publiée" : "rendue privée"}${(result?.updated ?? state.selected.size) > 1 ? "s" : ""}.`);
        state.selected.clear(); await loadTracks(); render();
    }

    const click = async (event) => {
        const view = event.target.closest(".sonora-sidebar [data-view]")?.dataset.view;
        const action = event.target.closest("[data-action]")?.dataset.action;
        const visibility = event.target.closest("[data-visibility]")?.dataset.visibility;
        const selectedTrack = event.target.closest("[data-select-track]")?.dataset.selectTrack;
        try {
            if (view) setView(view);
            else if (visibility) { state.visibility = visibility; render(); }
            else if (selectedTrack) { event.target.checked ? state.selected.add(selectedTrack) : state.selected.delete(selectedTrack); render(); }
            else if (action === "select-visible") {
                const visible = state.tracks.filter((track) => (state.visibility === "all" || track.visibility === state.visibility) && `${track.title} ${track.artist} ${track.album} ${track.owner_id || ""}`.toLocaleLowerCase("fr").includes(state.query));
                visible.forEach((track) => event.target.checked ? state.selected.add(String(track.id)) : state.selected.delete(String(track.id))); render();
            }
            else if (action === "open-import") setView("import");
            else if (action === "reload") { await loadAll(); render(); toast?.("Catalogue actualisé."); }
            else if (action === "create-album") await createCollection("album");
            else if (action === "create-playlist") await createCollection("playlist");
            else if (action === "bulk-public") await setBulkVisibility("public");
            else if (action === "bulk-private") await setBulkVisibility("private");
            else if (action === "edit-track") await editTrack(event.target.closest("[data-track-id]").dataset.trackId);
        } catch (error) { toast?.(error.message); }
    };
    const input = () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { state.query = search.value.trim().toLocaleLowerCase("fr"); render(); }, 180); };
    root.addEventListener("click", click); search.addEventListener("input", input);

    try {
        const status = await requestJson("/api/sonora-studio/status");
        state.authenticated = status.authenticated;
        root.querySelector("[data-connection-label]").textContent = status.authenticated ? "Session Kyros active" : "Session requise";
        shell.classList.toggle("is-connected", status.authenticated);
        if (status.authenticated) await loadAll();
    } catch (error) { root.querySelector("[data-connection-label]").textContent = "Indisponible"; toast?.(error.message); }
    render();
    return () => { clearTimeout(searchTimer); root.removeEventListener("click", click); search.removeEventListener("input", input); };
}
