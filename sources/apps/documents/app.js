import { requestJson, patchJson, postJson } from "/assets/javascripts/luma-api.js";

const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[character]);
const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
const fileIcon = (kind) => kind === "folder" ? icon("folder") : '<svg class="icon" aria-hidden="true" viewBox="0 0 24 24"><path d="M6 2h8l4 4v16H6z"/><path d="M14 2v5h5M9 13h6M9 17h5"/></svg>';

function formatBytes(value) {
    if (value < 1024) return `${value} o`;
    const units = ["Ko", "Mo", "Go"];
    let amount = value / 1024;
    let unit = units[0];
    for (let index = 1; amount >= 1024 && index < units.length; index += 1) { amount /= 1024; unit = units[index]; }
    return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: amount >= 10 ? 0 : 1 }).format(amount)} ${unit}`;
}

function formatDate(value) {
    return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function typeLabel(item) {
    if (item.kind === "folder") return "Dossier";
    const known = {
        "application/pdf": "Document PDF",
        "text/plain": "Document texte",
        "text/markdown": "Document Markdown",
        "image/png": "Image PNG",
        "image/jpeg": "Image JPEG",
        "application/zip": "Archive ZIP",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Document texte",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Feuille de calcul",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": "Présentation"
    };
    return known[item.mimeType] || "Fichier";
}

function renderShell(root, trashMode) {
    root.innerHTML = `
        <div class="documents-app" data-trash="${trashMode}" data-view="list">
            <aside class="documents-sidebar">
                <div class="documents-location-title"><span class="app-icon app-icon--documents">${icon("folder")}</span><strong>Documents</strong></div>
                <nav class="documents-nav documents-nav--quick" aria-label="Accès rapide">
                    <span class="documents-nav-label">Accès rapide</span>
                    <button type="button" data-location="root">${icon("folder")}<span>Mes fichiers</span></button>
                    <button type="button" data-location="image">${icon("image")}<span>Images</span></button>
                    <button type="button" data-location="video">${icon("device")}<span>Vidéos</span></button>
                    <button type="button" data-location="audio">${icon("volume")}<span>Musique</span></button>
                    <button type="button" data-location="document">${icon("notepad")}<span>Documents</span></button>
                    <button type="button" data-location="recent" disabled>${icon("search")}<span>Récents</span><small>Bientôt</small></button>
                </nav>
                <nav class="documents-nav" aria-label="Système">
                    <span class="documents-nav-label">Système</span>
                    <button type="button" data-location="trash">${icon("trash")}<span>Corbeille</span></button>
                </nav>
                <div class="storage-summary">
                    <div><span>Stockage personnel</span><strong data-storage-label>0 o / 1 Go</strong></div>
                    <div class="storage-track"><i data-storage-meter></i></div>
                    <small>La Corbeille utilise aussi votre espace.</small>
                </div>
            </aside>
            <main class="documents-main">
                <div class="documents-toolbar">
                    <div class="toolbar-primary">
                        <button class="toolbar-button toolbar-button--primary" type="button" data-action="new-folder">${icon("folder")}<span>Nouveau dossier</span></button>
                        <button class="toolbar-button" type="button" data-action="upload">${fileIcon("file")}<span>Importer</span></button>
                        <input class="document-upload" type="file" hidden>
                    </div>
                    <div class="toolbar-context" aria-label="Actions sur la sélection">
                        <button class="toolbar-button" type="button" data-action="open" disabled>Ouvrir</button>
                        <button class="toolbar-button" type="button" data-action="download" disabled>Télécharger</button>
                        <button class="toolbar-button" type="button" data-action="rename" disabled>Renommer</button>
                        <button class="toolbar-button" type="button" data-action="move" disabled>Déplacer</button>
                        <button class="toolbar-button toolbar-button--danger" type="button" data-action="trash" disabled>${icon("trash")}<span>Supprimer</span></button>
                        <button class="toolbar-button" type="button" data-action="restore" disabled>Restaurer</button>
                        <button class="toolbar-button toolbar-button--danger" type="button" data-action="delete" disabled>Supprimer définitivement</button>
                        <button class="toolbar-button toolbar-button--danger" type="button" data-action="empty-trash">Vider la Corbeille</button>
                    </div>
                    <div class="view-controls" aria-label="Mode d’affichage">
                        <button class="is-selected" type="button" data-view="list" aria-label="Afficher en liste"><svg class="icon" viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r="1" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r="1" fill="currentColor" stroke="none"/></svg></button>
                        <button type="button" data-view="grid" aria-label="Afficher en grille"><svg class="icon" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></button>
                    </div>
                    <label class="documents-search">${icon("search")}<span class="sr-only">Rechercher dans Documents</span><input type="search" placeholder="Rechercher dans Documents"></label>
                </div>
                <div class="documents-path" aria-label="Chemin du dossier"></div>
                <div class="documents-selection-bar" hidden><span></span><button type="button" data-action="clear-selection">Effacer la sélection</button></div>
                <div class="documents-browser-shell">
                    <section class="documents-browser" aria-live="polite">
                        <div class="documents-table-head"><label><input type="checkbox" data-action="select-all"><span class="sr-only">Tout sélectionner</span></label><span>Nom</span><span>Modifié</span><span>Type</span><span>Taille</span></div>
                        <div class="documents-list"></div>
                    </section>
                    <aside class="document-details" aria-label="Détails de la sélection"></aside>
                </div>
            </main>
            <dialog class="documents-dialog"><form method="dialog"><div data-dialog-content></div></form></dialog>
        </div>`;
}

function dialog(root, { title, description, field, options, confirm = "Valider", danger = false }) {
    const element = root.querySelector(".documents-dialog");
    const content = element.querySelector("[data-dialog-content]");
    content.innerHTML = `<h2>${escapeHtml(title)}</h2>${description ? `<p>${escapeHtml(description)}</p>` : ""}
        ${field ? options ? `<label>${escapeHtml(field.label)}<select name="value">${options.map((option) => `<option value="${option.id || ""}">${escapeHtml(option.name)}</option>`).join("")}</select></label>` : `<label>${escapeHtml(field.label)}<input name="value" value="${escapeHtml(field.value || "")}" maxlength="180" required></label>` : ""}
        <div class="dialog-actions"><button value="cancel">Annuler</button><button class="${danger ? "is-danger" : "is-primary"}" value="confirm">${escapeHtml(confirm)}</button></div>`;
    element.showModal();
    const input = content.querySelector("input, select");
    input?.focus();
    input?.select?.();
    return new Promise((resolve) => element.addEventListener("close", () => resolve(element.returnValue === "confirm" ? (input?.value ?? true) : null), { once: true }));
}

const QUICK_LOCATIONS = new Set(["image", "video", "audio", "document"]);
const QUICK_LABELS = { image: "Images", video: "Vidéos", audio: "Musique", document: "Documents" };

export async function mount(root, { app, toast, open }) {
    const state = { trash: app.id === "trash", parentId: null, search: "", view: "list", selected: new Set(), data: null, type: null };
    renderShell(root, state.trash);
    const shell = root.querySelector(".documents-app");
    const list = root.querySelector(".documents-list");
    const search = root.querySelector(".documents-search input");
    let searchTimer;

    function selectedItems() { return state.data.items.filter((item) => state.selected.has(item.id)); }

    function updateActions() {
        const selection = selectedItems();
        const count = selection.length;
        shell.classList.toggle("has-selection", count > 0);
        root.querySelector(".documents-selection-bar").hidden = count === 0;
        root.querySelector(".documents-selection-bar span").textContent = `${count} élément${count > 1 ? "s" : ""} sélectionné${count > 1 ? "s" : ""}`;
        root.querySelector('[data-action="download"]').disabled = count !== 1 || selection[0]?.kind !== "file" || state.trash;
        root.querySelector('[data-action="open"]').disabled = count !== 1 || selection[0]?.kind !== "file" || state.trash;
        root.querySelector('[data-action="rename"]').disabled = count !== 1 || state.trash;
        root.querySelector('[data-action="move"]').disabled = count < 1 || state.trash;
        root.querySelector('[data-action="trash"]').disabled = count < 1 || state.trash;
        root.querySelector('[data-action="restore"]').disabled = count < 1 || !state.trash;
        root.querySelector('[data-action="delete"]').disabled = count < 1 || !state.trash;
        root.querySelector('[data-action="select-all"]').checked = count > 0 && count === state.data.items.length;
        const details = root.querySelector(".document-details");
        if (count === 1) {
            const item = selection[0];
            details.innerHTML = `<span class="detail-icon document-kind document-kind--${item.kind}">${fileIcon(item.kind)}</span><h2>${escapeHtml(item.name)}</h2><dl><div><dt>Type</dt><dd>${typeLabel(item)}</dd></div><div><dt>Taille</dt><dd>${item.kind === "file" ? formatBytes(item.size) : "—"}</dd></div><div><dt>Modifié</dt><dd>${formatDate(item.updatedAt)}</dd></div>${item.trashedAt ? `<div><dt>Supprimé</dt><dd>${formatDate(item.trashedAt)}</dd></div>` : ""}</dl>`;
        } else if (count > 1) {
            details.innerHTML = `<span class="detail-icon">${icon("folder")}</span><h2>${count} éléments</h2><p>Utilisez les actions de la barre d’outils pour gérer cette sélection.</p>`;
        } else {
            details.innerHTML = `<span class="detail-icon">${icon("luma")}</span><h2>Détails</h2><p>Sélectionnez un élément pour afficher ses informations.</p>`;
        }
    }

    function render() {
        const { items, breadcrumbs, storage } = state.data;
        shell.dataset.trash = String(state.trash);
        shell.dataset.view = state.view;
        root.querySelectorAll(".view-controls [data-view]").forEach((button) => button.classList.toggle("is-selected", button.dataset.view === state.view));
        root.querySelectorAll(".documents-nav [data-location]").forEach((button) => {
            const location = button.dataset.location;
            const current = location === "root" ? (!state.trash && !state.type) : location === "trash" ? state.trash : location === state.type;
            button.classList.toggle("is-current", current);
        });
        root.querySelector(".documents-path").innerHTML = state.trash
            ? `<strong>${icon("trash")} Corbeille</strong><span>Suppression automatique après ${state.data.retentionDays} jours</span>`
            : state.type
                ? `<strong>${icon("folder")} ${QUICK_LABELS[state.type]}</strong><span>${state.data.items.length} élément${state.data.items.length > 1 ? "s" : ""}</span>`
                : `<button type="button" data-breadcrumb="">Mes fichiers</button>${breadcrumbs.map((crumb) => `${icon("chevron")}<button type="button" data-breadcrumb="${crumb.id}">${escapeHtml(crumb.name)}</button>`).join("")}<span class="mobile-storage-label">${formatBytes(storage.usedBytes)} / 1 Go</span>`;
        const percent = Math.min(100, storage.usedBytes / storage.quotaBytes * 100);
        root.querySelector("[data-storage-label]").textContent = `${formatBytes(storage.usedBytes)} / 1 Go`;
        root.querySelector("[data-storage-meter]").style.transform = `scaleX(${percent / 100})`;
        list.innerHTML = items.length ? items.map((item) => `
            <article class="document-row ${state.selected.has(item.id) ? "is-selected" : ""}" data-item-id="${item.id}" tabindex="0">
                <label><input type="checkbox" ${state.selected.has(item.id) ? "checked" : ""} aria-label="Sélectionner ${escapeHtml(item.name)}"></label>
                <span class="document-name"><i class="document-kind document-kind--${item.kind}">${fileIcon(item.kind)}</i><strong>${escapeHtml(item.name)}</strong></span>
                <time datetime="${item.updatedAt}">${formatDate(item.trashedAt || item.updatedAt)}</time>
                <span>${typeLabel(item)}</span>
                <span>${item.kind === "file" ? formatBytes(item.size) : "—"}</span>
            </article>`).join("") : `<div class="documents-empty">${state.trash ? icon("trash") : icon(state.type || "folder")}<h2>${state.trash ? "La Corbeille est vide" : state.search ? "Aucun résultat" : state.type ? `Aucun fichier dans ${QUICK_LABELS[state.type].toLocaleLowerCase("fr")}` : "Ce dossier est prêt"}</h2><p>${state.trash ? "Les éléments supprimés apparaîtront ici pendant 30 jours." : state.search ? "Essayez un autre nom ou revenez à vos fichiers." : state.type ? "Importez des fichiers de ce type ou parcourez Mes fichiers." : "Créez un dossier ou importez votre premier fichier."}</p></div>`;
        updateActions();
    }

    async function load() {
        list.innerHTML = '<p class="documents-loading">Chargement de vos documents…</p>';
        const params = new URLSearchParams();
        if (state.parentId) params.set("parentId", state.parentId);
        if (state.search) params.set("search", state.search);
        if (state.type) params.set("type", state.type);
        if (state.trash) params.set("trash", "true");
        try {
            state.data = await requestJson(`/api/documents?${params}`);
            state.selected.clear();
            render();
        } catch (error) {
            list.innerHTML = `<div class="documents-empty"><h2>Documents indisponible</h2><p>${escapeHtml(error.message)}</p><button type="button" data-action="reload">Réessayer</button></div>`;
        }
    }

    async function uploadFile(file) {
        const form = new FormData();
        form.append("file", file);
        if (state.parentId) form.append("parentId", state.parentId);
        const response = await fetch("/api/documents/upload", { method: "POST", credentials: "same-origin", headers: { accept: "application/json" }, body: form });
        const payload = await response.json();
        if (!response.ok || !payload.success) throw new Error(payload.message || "L’import a échoué.");
    }

    function openItem(item) {
        if (item.mimeType?.startsWith("image/")) {
            open("image-viewer", { instanceKey: `image:${item.id}`, title: item.name, data: { document: item } });
        } else if (item.mimeType?.startsWith("audio/") || /\.(?:mp3|wav|ogg|oga|m4a|aac|flac|opus|weba)$/i.test(item.name)) {
            open("music-player", { instanceKey: `music:${item.id}`, title: item.name, data: { document: item } });
        } else if (item.mimeType?.startsWith("video/") || /\.(?:mp4|m4v|webm|mov|mkv|ogv)$/i.test(item.name)) {
            open("video-player", { instanceKey: `video:${item.id}`, title: item.name, data: { document: item } });
        } else if (item.mimeType?.startsWith("text/") || /\.(?:md|markdown|txt)$/i.test(item.name)) {
            open("notepad", { instanceKey: `document:${item.id}`, title: item.name, data: { document: item } });
        } else {
            window.location.assign(`/api/documents/${item.id}/download`);
        }
    }

    async function perform(action) {
        const selection = selectedItems();
        if (action === "new-folder") {
            const name = await dialog(root, { title: "Nouveau dossier", description: "Donnez un nom clair à ce nouvel espace.", field: { label: "Nom du dossier" }, confirm: "Créer" });
            if (name) await postJson("/api/documents/folders", { name, parentId: state.parentId });
        } else if (action === "upload") {
            root.querySelector(".document-upload").click(); return;
        } else if (action === "open") {
            openItem(selection[0]); return;
        } else if (action === "download") {
            window.location.assign(`/api/documents/${selection[0].id}/download`); return;
        } else if (action === "rename") {
            const name = await dialog(root, { title: "Renommer", field: { label: "Nouveau nom", value: selection[0].name }, confirm: "Renommer" });
            if (name) await patchJson(`/api/documents/${selection[0].id}`, { name });
        } else if (action === "move") {
            const folders = (await requestJson("/api/documents/folders")).filter((folder) => !state.selected.has(folder.id));
            const target = await dialog(root, { title: `Déplacer ${selection.length > 1 ? "les éléments" : selection[0].name}`, field: { label: "Dossier de destination" }, options: folders, confirm: "Déplacer" });
            if (target !== null) await Promise.all(selection.map((item) => patchJson(`/api/documents/${item.id}`, { parentId: target || null })));
        } else if (action === "trash") {
            await postJson("/api/documents/actions/trash", { ids: [...state.selected] });
            toast("Déplacé dans la Corbeille. Suppression automatique dans 30 jours.");
        } else if (action === "restore") {
            await postJson("/api/documents/actions/restore", { ids: [...state.selected] });
            toast("Élément restauré.");
        } else if (action === "delete") {
            const confirmed = await dialog(root, { title: "Supprimer définitivement ?", description: "Cette action est irréversible et libère immédiatement votre espace.", confirm: "Supprimer", danger: true });
            if (confirmed) await postJson("/api/documents/actions/delete", { ids: [...state.selected] }); else return;
        } else if (action === "empty-trash") {
            if (!state.data.items.length) { toast("La Corbeille est déjà vide."); return; }
            const confirmed = await dialog(root, { title: "Vider la Corbeille ?", description: "Tous les éléments seront supprimés définitivement. Cette action est irréversible.", confirm: "Vider la Corbeille", danger: true });
            if (confirmed) { await postJson("/api/documents/actions/empty-trash"); toast("La Corbeille a été vidée."); } else return;
        } else if (action === "clear-selection") {
            state.selected.clear(); render(); return;
        } else if (action === "reload") { await load(); return; }
        await load();
    }

    const click = async (event) => {
        const action = event.target.closest("[data-action]")?.dataset.action;
        const location = event.target.closest("[data-location]")?.dataset.location;
        const breadcrumb = event.target.closest("[data-breadcrumb]");
        const view = event.target.closest(".view-controls [data-view]")?.dataset.view;
        const row = event.target.closest("[data-item-id]");
        try {
            if (view) { state.view = view; render(); }
            else if (action === "select-all") {
                state.selected = event.target.checked ? new Set(state.data.items.map((item) => item.id)) : new Set(); render();
            } else if (action) await perform(action);
            else if (location === "recent") { /* bientôt */ }
            else if (location) {
                state.trash = location === "trash";
                state.type = QUICK_LOCATIONS.has(location) ? location : null;
                state.parentId = null; state.search = ""; search.value = ""; await load();
            }
            else if (breadcrumb) { state.parentId = breadcrumb.dataset.breadcrumb || null; state.search = ""; state.type = null; search.value = ""; await load(); }
            else if (row && event.target.matches('input[type="checkbox"]')) { event.target.checked ? state.selected.add(row.dataset.itemId) : state.selected.delete(row.dataset.itemId); render(); }
        } catch (error) { toast(error.message); }
    };
    const doubleClick = async (event) => {
        const row = event.target.closest("[data-item-id]");
        if (!row || state.trash) return;
        const item = state.data.items.find((entry) => entry.id === row.dataset.itemId);
        if (item.kind === "folder") { state.parentId = item.id; state.type = null; await load(); }
        else openItem(item);
    };
    const uploadChange = async (event) => {
        const [file] = event.target.files;
        if (!file) return;
        try { await uploadFile(file); toast(`${file.name} a été importé.`); await load(); } catch (error) { toast(error.message); }
        event.target.value = "";
    };
    const searchInput = () => {
        window.clearTimeout(searchTimer);
        searchTimer = window.setTimeout(() => { state.search = search.value.trim(); state.parentId = null; state.type = null; load(); }, 280);
    };

    root.addEventListener("click", click);
    root.addEventListener("dblclick", doubleClick);
    root.querySelector(".document-upload").addEventListener("change", uploadChange);
    search.addEventListener("input", searchInput);
    await load();
    return () => {
        window.clearTimeout(searchTimer);
        root.removeEventListener("click", click);
        root.removeEventListener("dblclick", doubleClick);
        search.removeEventListener("input", searchInput);
    };
}
