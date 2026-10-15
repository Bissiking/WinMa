import { requestJson, postJson } from "/assets/javascripts/luma-api.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);

const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
const typeLabels = { bug: "Bug", task: "Tâche", idea: "Idée", reminder: "Rappel", information: "Information" };
const priorityLabels = { low: "Basse", normal: "Normale", high: "Élevée", urgent: "Urgente" };

function formatDate(value, includeTime = false) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "Date inconnue";
    return new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "short",
        year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
        hour: includeTime ? "2-digit" : undefined,
        minute: includeTime ? "2-digit" : undefined
    }).format(date);
}

export async function mount(root, { toast }) {
    let notes = [];
    let filter = "all";
    let analyzedContent = "";

    root.innerHTML = `
        <!-- THESIS: BrainDump transforme une pensée brute en information rangée sans détour par un tableau de notes générique. OWN-WORLD: surfaces LUMA calmes, feuille de capture centrale et rail d’historique compact. STORY: écrire, vérifier ce que BrainDump comprend, enregistrer, puis retrouver ou supprimer. FIRST VIEWPORT: grand champ de capture à gauche, classification directement sous le texte et notes récentes dans le rail droit. FORM: espace de capture focalisé avec historique latéral, structure 4, seed 2c77f92f. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md. -->
        <div class="braindump-app">
            <header class="braindump-header">
                <div class="braindump-identity">
                    <span class="braindump-logo">${icon("notepad")}</span>
                    <div><h1>BrainDump</h1><p>Déposez la pensée. Le rangement vient ensuite.</p></div>
                </div>
                <span class="braindump-sync" role="status" aria-live="polite" data-status>Connexion…</span>
            </header>
            <main class="braindump-workspace">
                <section class="braindump-capture" aria-labelledby="braindump-capture-title">
                    <div class="braindump-capture__heading">
                        <div><h2 id="braindump-capture-title">Qu’avez-vous en tête&nbsp;?</h2><p>Une idée, une tâche, un rappel ou simplement une information à garder.</p></div>
                        <span data-character-count>0 / 5 000</span>
                    </div>
                    <textarea data-note maxlength="5000" spellcheck="true" placeholder="Ex. Penser à vérifier l’API LUMA demain matin…" aria-labelledby="braindump-capture-title" aria-describedby="braindump-shortcut"></textarea>
                    <div class="braindump-analysis" data-analysis hidden></div>
                    <p class="braindump-error" data-error role="alert" hidden></p>
                    <footer class="braindump-actions">
                        <span id="braindump-shortcut"><kbd>Ctrl</kbd><b>+</b><kbd>Entrée</kbd> pour enregistrer</span>
                        <div>
                            <button class="braindump-secondary" type="button" data-analyze>${icon("search")}<span>Analyser</span></button>
                            <button class="braindump-primary" type="button" data-save>${icon("notepad")}<span>Ranger la pensée</span></button>
                        </div>
                    </footer>
                </section>
                <aside class="braindump-history" aria-labelledby="braindump-history-title">
                    <header>
                        <div><h2 id="braindump-history-title">Notes récentes</h2><p data-count>Chargement…</p></div>
                        <button type="button" data-refresh aria-label="Actualiser les notes">${icon("refresh")}</button>
                    </header>
                    <div class="braindump-filters" role="group" aria-label="Filtrer les notes">
                        <button class="is-current" type="button" data-filter="all">Toutes</button>
                        <button type="button" data-filter="task">Tâches</button>
                        <button type="button" data-filter="idea">Idées</button>
                        <button type="button" data-filter="reminder">Rappels</button>
                    </div>
                    <div class="braindump-list" data-list aria-live="polite" aria-busy="true"></div>
                </aside>
            </main>
        </div>`;

    const elements = {
        textarea: root.querySelector("[data-note]"),
        analysis: root.querySelector("[data-analysis]"),
        error: root.querySelector("[data-error]"),
        count: root.querySelector("[data-count]"),
        characters: root.querySelector("[data-character-count]"),
        list: root.querySelector("[data-list]"),
        status: root.querySelector("[data-status]"),
        analyze: root.querySelector("[data-analyze]"),
        save: root.querySelector("[data-save]")
    };

    function setError(message = "") {
        elements.error.textContent = message;
        elements.error.hidden = !message;
    }

    function setBusy(button, busy, label) {
        const text = button.querySelector("span");
        if (!button.dataset.label) button.dataset.label = text.textContent;
        button.disabled = busy;
        button.setAttribute("aria-busy", String(busy));
        text.textContent = busy ? label : button.dataset.label;
    }

    function renderAnalysis(result) {
        analyzedContent = elements.textarea.value.trim();
        const metadata = [
            result.project ? `${icon("folder")}<span>${escapeHtml(result.project)}</span>` : "",
            result.dueDate ? `${icon("calendar")}<span>${escapeHtml(formatDate(result.dueDate, true))}</span>` : ""
        ].filter(Boolean).map((item) => `<span>${item}</span>`).join("");
        elements.analysis.innerHTML = `
            <div><strong>${icon("notepad")}BrainDump comprend</strong><span>${escapeHtml(result.confidence)} % de confiance</span></div>
            <div class="braindump-analysis__result">
                <span class="brain-chip brain-chip--${escapeHtml(result.type)}">${escapeHtml(typeLabels[result.type] || result.type)}</span>
                <span class="brain-priority brain-priority--${escapeHtml(result.priority)}">Priorité ${escapeHtml((priorityLabels[result.priority] || result.priority).toLocaleLowerCase("fr"))}</span>
                ${metadata}
            </div>`;
        elements.analysis.hidden = false;
    }

    function renderNotes() {
        const visible = filter === "all" ? notes : notes.filter((note) => note.type === filter);
        elements.count.textContent = `${notes.length} note${notes.length > 1 ? "s" : ""} dans votre espace`;
        if (!visible.length) {
            elements.list.innerHTML = `<div class="braindump-empty">${icon("notepad")}<h3>${notes.length ? "Aucune note dans ce filtre" : "Votre esprit a de la place"}</h3><p>${notes.length ? "Essayez une autre catégorie." : "Votre première pensée apparaîtra ici."}</p></div>`;
            return;
        }
        elements.list.innerHTML = visible.map((note) => {
            const tags = Array.isArray(note.tags) ? note.tags.slice(0, 2) : [];
            return `<article class="braindump-note">
                <div class="braindump-note__top">
                    <span class="brain-chip brain-chip--${escapeHtml(note.type)}">${escapeHtml(typeLabels[note.type] || note.type)}</span>
                    <button type="button" data-delete="${escapeHtml(note.id)}" aria-label="Supprimer cette note">${icon("trash")}</button>
                </div>
                <p>${escapeHtml(note.content)}</p>
                <footer>
                    ${note.project ? `<span>${icon("folder")}${escapeHtml(note.project)}</span>` : ""}
                    ${note.dueDate ? `<span>${icon("calendar")}${escapeHtml(formatDate(note.dueDate))}</span>` : ""}
                    ${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
                    <time datetime="${escapeHtml(note.createdAt)}">${escapeHtml(formatDate(note.createdAt))}</time>
                </footer>
            </article>`;
        }).join("");
    }

    async function loadNotes() {
        elements.list.setAttribute("aria-busy", "true");
        elements.status.textContent = "Synchronisation…";
        try {
            const payload = await requestJson("/api/braindump/notes");
            notes = Array.isArray(payload) ? payload : [];
            renderNotes();
            elements.status.textContent = "Synchronisé avec Kyros";
            setError();
        } catch (error) {
            elements.list.innerHTML = `<div class="braindump-empty braindump-empty--error"><h3>BrainDump ne répond pas</h3><p>${escapeHtml(error.message)}</p><button type="button" data-retry>Réessayer</button></div>`;
            elements.count.textContent = "Notes indisponibles";
            elements.status.textContent = "Hors connexion";
        } finally {
            elements.list.setAttribute("aria-busy", "false");
        }
    }

    async function analyze() {
        const content = elements.textarea.value.trim();
        if (content.length < 2) { setError("Écrivez au moins deux caractères avant l’analyse."); elements.textarea.focus(); return; }
        setError();
        setBusy(elements.analyze, true, "Analyse…");
        try { renderAnalysis(await postJson("/api/braindump/analyze", { content })); }
        catch (error) { setError(error.message); }
        finally { setBusy(elements.analyze, false); }
    }

    async function save() {
        const content = elements.textarea.value.trim();
        if (content.length < 2) { setError("Écrivez au moins deux caractères avant l’enregistrement."); elements.textarea.focus(); return; }
        setError();
        setBusy(elements.save, true, "Enregistrement…");
        try {
            await postJson("/api/braindump/notes", { content });
            elements.textarea.value = "";
            elements.characters.textContent = "0 / 5 000";
            elements.analysis.hidden = true;
            analyzedContent = "";
            await loadNotes();
            toast?.("La pensée est rangée dans BrainDump.");
            elements.textarea.focus();
        } catch (error) { setError(error.message); }
        finally { setBusy(elements.save, false); }
    }

    async function remove(id) {
        const note = notes.find((item) => String(item.id) === String(id));
        if (!note || !window.confirm(`Supprimer définitivement « ${note.content.slice(0, 80)}${note.content.length > 80 ? "…" : ""} » ?`)) return;
        try {
            await requestJson(`/api/braindump/notes/${encodeURIComponent(id)}`, { method: "DELETE" });
            notes = notes.filter((item) => String(item.id) !== String(id));
            renderNotes();
            toast?.("La note a été supprimée.");
        } catch (error) { setError(error.message); }
    }

    const onInput = () => {
        elements.characters.textContent = `${elements.textarea.value.length.toLocaleString("fr-FR")} / 5 000`;
        setError();
        if (analyzedContent && elements.textarea.value.trim() !== analyzedContent) elements.analysis.hidden = true;
    };
    const onClick = (event) => {
        if (event.target.closest("[data-analyze]")) analyze();
        else if (event.target.closest("[data-save]")) save();
        else if (event.target.closest("[data-refresh], [data-retry]")) loadNotes();
        else if (event.target.closest("[data-delete]")) remove(event.target.closest("[data-delete]").dataset.delete);
        else if (event.target.closest("[data-filter]")) {
            filter = event.target.closest("[data-filter]").dataset.filter;
            root.querySelectorAll("[data-filter]").forEach((button) => button.classList.toggle("is-current", button.dataset.filter === filter));
            renderNotes();
        }
    };
    const onKeydown = (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { event.preventDefault(); save(); }
    };

    elements.textarea.addEventListener("input", onInput);
    root.addEventListener("click", onClick);
    root.addEventListener("keydown", onKeydown);
    await loadNotes();
    elements.textarea.focus();

    return () => {
        elements.textarea.removeEventListener("input", onInput);
        root.removeEventListener("click", onClick);
        root.removeEventListener("keydown", onKeydown);
    };
}
