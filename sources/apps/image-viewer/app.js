const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

export async function mount(root, { app, options, toast }) {
    const item = options?.data?.document || app.data?.document;
    if (!item) throw new Error("Aucune image n’a été sélectionnée.");
    let zoom = 1;
    let objectUrl;
    root.innerHTML = `
        <div class="image-viewer-app">
            <header class="image-viewer-toolbar">
                <span>${escapeHtml(item.name)}</span>
                <div><button type="button" data-image-action="out" aria-label="Réduire l’image"><svg class="icon" aria-hidden="true"><use href="#icon-minus"></use></svg></button><output data-image-zoom>100 %</output><button type="button" data-image-action="in" aria-label="Agrandir l’image"><svg class="icon" aria-hidden="true"><use href="#icon-plus"></use></svg></button><button type="button" data-image-action="fit">Ajuster</button><a href="/api/documents/${item.id}/download">Télécharger</a></div>
            </header>
            <main class="image-viewer-canvas" data-fit="true"><p>Chargement de l’image…</p></main>
        </div>`;
    const canvas = root.querySelector(".image-viewer-canvas");
    const zoomOutput = root.querySelector("[data-image-zoom]");

    function applyZoom(fit = false) {
        const image = canvas.querySelector("img");
        if (!image) return;
        canvas.dataset.fit = String(fit);
        image.style.transform = fit ? "" : `scale(${zoom})`;
        zoomOutput.textContent = fit ? "Ajusté" : `${Math.round(zoom * 100)} %`;
    }

    const onClick = (event) => {
        const action = event.target.closest("[data-image-action]")?.dataset.imageAction;
        if (!action) return;
        if (action === "fit") return applyZoom(true);
        zoom = Math.min(4, Math.max(.25, zoom + (action === "in" ? .25 : -.25)));
        applyZoom(false);
    };
    root.addEventListener("click", onClick);

    try {
        const response = await fetch(`/api/documents/${item.id}/download`, { credentials: "same-origin" });
        if (!response.ok) throw new Error("L’image n’a pas pu être chargée.");
        objectUrl = URL.createObjectURL(await response.blob());
        canvas.innerHTML = `<img src="${objectUrl}" alt="${escapeHtml(item.name)}">`;
    } catch (error) {
        const message = error.message || "L’image n’a pas pu être chargée.";
        canvas.innerHTML = `<div class="image-viewer-error"><h2>Image indisponible</h2><p>${escapeHtml(message)}</p></div>`;
        toast?.(message);
    }

    return () => { root.removeEventListener("click", onClick); if (objectUrl) URL.revokeObjectURL(objectUrl); };
}
