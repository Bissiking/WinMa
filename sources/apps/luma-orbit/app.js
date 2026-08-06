const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;

const catalog = [
    { id: "nino", name: "Nino", icon: "luma", color: "#e8925b", category: "Création", description: "Un futur compagnon créatif de l’écosystème LUMA.", status: "Aperçu" },
    { id: "braindump", name: "BrainDump", icon: "notepad", color: "#54b693", category: "Productivité", description: "Un espace destiné à capturer et organiser les idées.", status: "Aperçu" },
    { id: "kyros", name: "Kyros", icon: "user", color: "#6e72e8", category: "Identité", description: "Votre compte et votre identité partagée dans l’écosystème.", status: "Intégré", action: "settings" },
    { id: "harmonix", name: "Harmonix", icon: "music", color: "#b05fe0", category: "Audio", description: "La bibliothèque musicale reliée au lecteur de Luma OS.", status: "Intégré", action: "harmonix" },
    { id: "arc", name: "A.R.C.", icon: "luma-network", color: "#3a9fd0", category: "Réseau", description: "Une future porte d’entrée vers les services A.R.C.", status: "Aperçu" }
];

function appLogo(app, className = "orbit-app-logo") {
    return `<span class="${className}" style="--app-color:${app.color}">${icon(app.icon)}</span>`;
}

export function mount(root, { open, toast }) {
    let query = "";
    let installed;
    try { installed = new Set(JSON.parse(localStorage.getItem("luma.orbit.installed") || "[]")); } catch { installed = new Set(); }

    root.innerHTML = `
        <!-- THESIS: Luma Orbit rend l’écosystème visible comme un réseau cohérent, sans imiter une grille de boutique mobile. OWN-WORLD: acrylique LUMA, orbites filaires et catalogue linéaire. STORY: comprendre les services, puis ajouter ou ouvrir une intégration. FIRST VIEWPORT: noyau Orbit et cinq satellites au-dessus d’un catalogue filtrable. FORM: constellation reliée et catalogue, structure 4, seed 36c5c15d. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md. -->
        <div class="orbit-app">
            <header class="orbit-header">
                <div class="orbit-identity"><span class="orbit-logo">${icon("orbit")}</span><div><h1>Luma Orbit</h1><p>Les applications de l’écosystème, réunies autour de votre espace.</p></div></div>
                <label class="orbit-search">${icon("search")}<span class="sr-only">Rechercher dans Luma Orbit</span><input type="search" placeholder="Rechercher une application"></label>
            </header>
            <section class="orbit-map" aria-labelledby="orbit-map-title">
                <div class="orbit-map__copy"><h2 id="orbit-map-title">Votre constellation LUMA</h2><p>Ce catalogue est une préfiguration : les installations restent simulées tant que les manifestes des applications ne sont pas reliés.</p></div>
                <div class="orbit-system" aria-label="Applications reliées à Luma OS">
                    <i class="orbit-path orbit-path--one"></i><i class="orbit-path orbit-path--two"></i>
                    <span class="orbit-core"><span>${icon("orbit")}</span><strong>Luma OS</strong></span>
                    ${catalog.map((app, index) => `<button type="button" class="orbit-node orbit-node--${index + 1}" data-orbit-focus="${app.id}" aria-label="Voir ${app.name}">${appLogo(app, "orbit-node__logo")}<strong>${app.name}</strong></button>`).join("")}
                </div>
            </section>
            <section class="orbit-catalog" aria-labelledby="orbit-catalog-title">
                <header><div><h2 id="orbit-catalog-title">Catalogue</h2><p><span data-orbit-count>${catalog.length}</span> applications et services annoncés</p></div><span class="orbit-preview-badge">Catalogue de démonstration</span></header>
                <div class="orbit-list"></div>
            </section>
        </div>`;

    const list = root.querySelector(".orbit-list");
    const search = root.querySelector(".orbit-search input");

    function render() {
        const visible = catalog.filter((app) => `${app.name} ${app.category} ${app.description}`.toLocaleLowerCase("fr").includes(query));
        root.querySelector("[data-orbit-count]").textContent = String(visible.length);
        list.innerHTML = visible.length ? visible.map((app) => {
            const isInstalled = installed.has(app.id);
            const actionLabel = app.action === "settings" ? "Ouvrir le compte" : app.action === "harmonix" ? "Déjà actif" : isInstalled ? "Retirer" : "Ajouter";
            return `<article class="orbit-row" data-orbit-app="${app.id}">
                ${appLogo(app)}
                <div class="orbit-row__copy"><div><h3>${escapeHtml(app.name)}</h3><span>${escapeHtml(app.category)}</span></div><p>${escapeHtml(app.description)}</p></div>
                <span class="orbit-row__status">${escapeHtml(isInstalled ? "Ajoutée au prototype" : app.status)}</span>
                <button type="button" data-orbit-action="${app.id}" ${app.action === "harmonix" ? "disabled" : ""}>${actionLabel}</button>
            </article>`;
        }).join("") : `<div class="orbit-empty"><h3>Aucune application trouvée</h3><p>Essayez un autre nom ou une autre catégorie.</p></div>`;
    }

    const onInput = () => { query = search.value.trim().toLocaleLowerCase("fr"); render(); };
    const onClick = (event) => {
        const focusId = event.target.closest("[data-orbit-focus]")?.dataset.orbitFocus;
        const actionId = event.target.closest("[data-orbit-action]")?.dataset.orbitAction;
        if (focusId) {
            query = catalog.find((app) => app.id === focusId)?.name.toLocaleLowerCase("fr") || "";
            search.value = catalog.find((app) => app.id === focusId)?.name || "";
            render();
            root.querySelector(".orbit-catalog").scrollIntoView({ behavior: "smooth", block: "start" });
        } else if (actionId) {
            const app = catalog.find((item) => item.id === actionId);
            if (app.action === "settings") { open("settings"); return; }
            installed.has(actionId) ? installed.delete(actionId) : installed.add(actionId);
            localStorage.setItem("luma.orbit.installed", JSON.stringify([...installed]));
            render();
            toast?.(`${app.name} ${installed.has(actionId) ? "a été ajoutée au prototype" : "a été retirée du prototype"}.`);
        }
    };

    search.addEventListener("input", onInput);
    root.addEventListener("click", onClick);
    render();
    return () => { search.removeEventListener("input", onInput); root.removeEventListener("click", onClick); };
}
