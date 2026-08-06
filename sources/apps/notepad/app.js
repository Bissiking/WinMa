import { requestJson, postJson, putJson, patchJson } from "/assets/javascripts/luma-api.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

function inlineMarkdown(value) {
    return escapeHtml(value)
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function markdown(value) {
    const lines = String(value).replace(/\r\n?/g, "\n").split("\n");
    const output = [];
    let inCode = false;
    let list = false;
    const closeList = () => { if (list) { output.push("</ul>"); list = false; } };
    for (const line of lines) {
        if (line.trim().startsWith("```")) {
            closeList();
            output.push(inCode ? "</code></pre>" : "<pre><code>");
            inCode = !inCode;
        } else if (inCode) output.push(`${escapeHtml(line)}\n`);
        else if (/^#{1,3}\s/.test(line)) {
            closeList();
            const level = line.match(/^#+/)[0].length;
            output.push(`<h${level}>${inlineMarkdown(line.slice(level).trim())}</h${level}>`);
        } else if (/^[-*]\s+/.test(line)) {
            if (!list) { output.push("<ul>"); list = true; }
            output.push(`<li>${inlineMarkdown(line.replace(/^[-*]\s+/, ""))}</li>`);
        } else if (/^>\s?/.test(line)) {
            closeList(); output.push(`<blockquote>${inlineMarkdown(line.replace(/^>\s?/, ""))}</blockquote>`);
        } else if (!line.trim()) {
            closeList(); output.push("<br>");
        } else {
            closeList(); output.push(`<p>${inlineMarkdown(line)}</p>`);
        }
    }
    closeList();
    if (inCode) output.push("</code></pre>");
    return output.join("");
}

export async function mount(root, { app, options, setTitle, toast }) {
    const source = options?.data?.document || app.data?.document || null;
    let item = source;
    let savedName = source?.name || "Sans titre.md";
    let savedContent = "";
    let mode = "edit";

    root.innerHTML = `
        <div class="notepad-app">
            <header class="notepad-toolbar">
                <label><span class="sr-only">Nom du document</span><input data-note-name maxlength="180" value="${escapeHtml(savedName)}"></label>
                <div class="notepad-modes" aria-label="Mode d’affichage">
                    <button class="is-current" type="button" data-note-mode="edit">Écrire</button>
                    <button type="button" data-note-mode="preview">Aperçu</button>
                </div>
                <span class="notepad-status" role="status" aria-live="polite">${source ? "Chargement…" : "Nouveau document"}</span>
                <button class="notepad-save" type="button" data-note-save>Enregistrer</button>
            </header>
            <main class="notepad-workspace" data-mode="edit">
                <textarea data-note-editor spellcheck="true" aria-label="Contenu de la note" placeholder="Commencez à écrire…"></textarea>
                <article class="notepad-preview" data-note-preview aria-label="Aperçu Markdown"></article>
            </main>
        </div>`;

    const nameInput = root.querySelector("[data-note-name]");
    const editor = root.querySelector("[data-note-editor]");
    const preview = root.querySelector("[data-note-preview]");
    const status = root.querySelector(".notepad-status");
    const saveButton = root.querySelector("[data-note-save]");

    function updateDirty() {
        const dirty = editor.value !== savedContent || nameInput.value.trim() !== savedName;
        status.textContent = dirty ? "Modifications non enregistrées" : item ? "Enregistré" : "Nouveau document";
        setTitle(`${dirty ? "• " : ""}${nameInput.value.trim() || "Sans titre"}`);
    }

    function setMode(nextMode) {
        mode = nextMode;
        root.querySelector(".notepad-workspace").dataset.mode = mode;
        root.querySelectorAll("[data-note-mode]").forEach((button) => button.classList.toggle("is-current", button.dataset.noteMode === mode));
        if (mode === "preview") preview.innerHTML = markdown(editor.value);
        else editor.focus();
    }

    async function save() {
        const name = nameInput.value.trim() || "Sans titre.md";
        saveButton.disabled = true;
        status.textContent = "Enregistrement…";
        try {
            if (!item) item = await postJson("/api/documents/text", { name, content: editor.value });
            else {
                await putJson(`/api/documents/${item.id}/content`, { content: editor.value });
                if (name !== savedName) item = await patchJson(`/api/documents/${item.id}`, { name });
            }
            savedName = name;
            savedContent = editor.value;
            nameInput.value = name;
            setTitle(name);
            status.textContent = "Enregistré";
            toast?.(`${name} a été enregistré.`);
        } catch (error) {
            status.textContent = "Échec de l’enregistrement";
            toast?.(error.message);
        } finally { saveButton.disabled = false; }
    }

    const onInput = () => { updateDirty(); if (mode === "preview") preview.innerHTML = markdown(editor.value); };
    const onClick = (event) => {
        const nextMode = event.target.closest("[data-note-mode]")?.dataset.noteMode;
        if (nextMode) setMode(nextMode);
        else if (event.target.closest("[data-note-save]")) save();
    };
    const onKeydown = (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "s") { event.preventDefault(); save(); }
    };

    root.addEventListener("input", onInput);
    root.addEventListener("click", onClick);
    root.addEventListener("keydown", onKeydown);

    if (source) {
        try {
            const data = await requestJson(`/api/documents/${source.id}/content`);
            item = data.item;
            savedName = data.item.name;
            savedContent = data.content;
            nameInput.value = savedName;
            editor.value = savedContent;
            status.textContent = "Enregistré";
            setTitle(savedName);
        } catch (error) {
            status.textContent = "Document indisponible";
            editor.disabled = true;
            saveButton.disabled = true;
            toast?.(error.message);
        }
    } else editor.focus();

    return () => {
        root.removeEventListener("input", onInput);
        root.removeEventListener("click", onClick);
        root.removeEventListener("keydown", onKeydown);
    };
}
