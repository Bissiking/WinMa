const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;

const catalog = [
    {
        id: "nino", name: "Nino", icon: "luma", color: "#e8925b", category: "Création",
        description: "Un futur compagnon créatif de l’écosystème LUMA.",
        descriptionLongue: "Un futur compagnon créatif de l’écosystème LUMA, pensé pour accompagner vos projets : esquisse, composition et exploration restent à définir avec le produit.",
        status: "Bientôt", available: false
    },
    {
        id: "braindump", name: "BrainDump", icon: "notepad", color: "#54b693", category: "Productivité",
        description: "Capturez une pensée et classez-la automatiquement par type, priorité, projet et échéance.",
        descriptionLongue: "BrainDump capture une pensée dans votre espace LUMA, puis la classe automatiquement par type, priorité, projet et échéance. Aucun token n’est conservé dans l’application : l’identité de votre session Luma OS suffit.",
        status: "Disponible", action: "braindump"
    },
    {
        id: "harmonix", name: "Harmonix", icon: "music", color: "#b05fe0", category: "Audio",
        description: "La bibliothèque musicale reliée au lecteur de Luma OS.",
        descriptionLongue: "Harmonix rassemble votre bibliothèque musicale et la relie au lecteur de Luma OS. Une fois activée, vos pistes rejoignent la lecture du bureau et restent accessibles depuis le système.",
        status: "Intégré", action: "harmonix"
    },
    {
        id: "sonora-studio", name: "Sonora Studio", icon: "music", color: "#8b78ff", category: "Audio",
        description: "Administrez le catalogue Sonora, les imports, albums et playlists depuis Luma OS.",
        descriptionLongue: "Sonora Studio administre le catalogue Sonora depuis Luma OS : imports de morceaux, albums, playlists et rôles. Les permissions sont contrôlées par Sonora via votre identité de session, jamais par le navigateur.",
        status: "Disponible", action: "sonora-studio"
    },
    {
        id: "arc", name: "A.R.C.", icon: "luma-network", color: "#3a9fd0", category: "Réseau",
        description: "Une future porte d’entrée vers les services A.R.C.",
        descriptionLongue: "A.R.C. doit devenir une porte d’entrée vers les services A.R.C. de l’écosystème LUMA. La forme précise du service reste à définir avec le produit.",
        status: "Bientôt", available: false
    }
];

function appLogo(app, className = "orbit-app-logo") {
    return `<span class="${className}" style="--app-color:${app.color}">${icon(app.icon)}</span>`;
}

export function mount(root, { open, toast }) {
    let query = "";
    let selected = null;
    let installed;
    let harmonixEnabled = localStorage.getItem("luma.harmonix.enabled") !== "false";
    try { installed = new Set(JSON.parse(localStorage.getItem("luma.orbit.installed") || "[]")); } catch { installed = new Set(); }

    root.innerHTML = `
        <!-- THESIS: Luma Orbit rend l’écosystème visible comme un réseau cohérent, sans imiter une grille de boutique mobile. OWN-WORLD: acrylique LUMA, orbites filaires et catalogue linéaire. STORY: comprendre les services, puis ajouter ou ouvrir une intégration. FIRST VIEWPORT: noyau Orbit et satellites au-dessus d’un catalogue filtrable. FORM: constellation reliée et catalogue, fiche produit pour chaque application, structure 4, seed 36c5c15d. FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md. -->
        <div class="orbit-app">
            <header class="orbit-header">
                <div class="orbit-identity"><span class="orbit-logo">${icon("orbit")}</span><div><h1>Luma Orbit</h1><p>Les applications de l’écosystème, réunies autour de votre espace.</p></div></div>
                <label class="orbit-search">${icon("search")}<span class="sr-only">Rechercher dans Luma Orbit</span><input type="search" placeholder="Rechercher une application"></label>
            </header>
            <main class="orbit-body"></main>
        </div>`;

    const body = root.querySelector(".orbit-body");
    const search = root.querySelector(".orbit-search input");

    function isInstalled(app) {
        return app.available !== false && (app.action === "harmonix" ? harmonixEnabled : installed.has(app.id));
    }

    function actionLabel(app) {
        if (app.available === false) return "Bientôt disponible";
        if (app.action === "settings") return "Ouvrir le compte";
        if (app.action === "harmonix") return isInstalled(app) ? "Désactiver" : "Activer";
        if (app.action && isInstalled(app)) return "Ouvrir";
        if (app.action) return "Installer";
        return isInstalled(app) ? "Ouvrir" : "Installer";
    }

    function statusLabel(app) {
        if (app.action === "harmonix") return isInstalled(app) ? "Intégré" : "Désactivé";
        return isInstalled(app) ? "Installé" : app.status;
    }

    function renderList() {
        const visible = catalog.filter((app) => `${app.name} ${app.category} ${app.description}`.toLocaleLowerCase("fr").includes(query));
        const list = visible.length ? visible.map((app) => {
            const appInstalled = isInstalled(app);
            const showUninstall = appInstalled && app.available !== false && app.action !== "harmonix";
            return `<article class="orbit-row${app.available === false ? " is-coming-soon" : ""}" data-orbit-open="${app.id}" tabindex="0" role="button" aria-label="Voir la fiche de ${app.name}">
                ${appLogo(app)}
                <div class="orbit-row__copy"><div><h3>${escapeHtml(app.name)}</h3><span>${escapeHtml(app.category)}</span></div><p>${escapeHtml(app.description)}</p></div>
                <span class="orbit-row__status">${escapeHtml(statusLabel(app))}</span>
                <div class="orbit-row__actions">
                    ${showUninstall ? `<button type="button" class="orbit-row__uninstall" data-orbit-uninstall="${app.id}" title="Désinstaller ${escapeHtml(app.name)}" aria-label="Désinstaller ${escapeHtml(app.name)}">${icon("trash")}</button>` : ""}
                    <button type="button" data-orbit-action="${app.id}" ${app.available === false ? "disabled" : ""}>${actionLabel(app)}</button>
                </div>
            </article>`;
        }).join("")
            : `<div class="orbit-empty"><h3>Aucune application trouvée</h3><p>Essayez un autre nom ou une autre catégorie.</p></div>`;
        body.innerHTML = `
            <section class="orbit-map" aria-labelledby="orbit-map-title">
                <div class="orbit-map__copy"><h2 id="orbit-map-title">Votre constellation LUMA</h2><p>Ce catalogue est une préfiguration : les installations restent simulées tant que les manifestes des applications ne sont pas reliés.</p></div>
                <div class="orbit-system" aria-label="Applications reliées à Luma OS">
                    <i class="orbit-path orbit-path--one"></i><i class="orbit-path orbit-path--two"></i>
                    <span class="orbit-core"><span>${icon("orbit")}</span><strong>Luma OS</strong></span>
                    ${catalog.map((app, index) => `<button type="button" class="orbit-node orbit-node--${index + 1}${app.available === false ? " is-coming-soon" : ""}" data-orbit-open="${app.id}" aria-label="Voir la fiche de ${app.name}${app.available === false ? ", bientôt disponible" : ""}">${appLogo(app, "orbit-node__logo")}<strong>${app.name}</strong>${app.available === false ? "<small>Bientôt</small>" : ""}</button>`).join("")}
                </div>
            </section>
            <section class="orbit-catalog" aria-labelledby="orbit-catalog-title">
                <header><div><h2 id="orbit-catalog-title">Catalogue</h2><p><span data-orbit-count>${visible.length}</span> applications et services annoncés</p></div></header>
                <div class="orbit-list">${list}</div>
            </section>`;
    }

    function renderDetail() {
        const app = catalog.find((item) => item.id === selected);
        if (!app) { renderList(); return; }
        const comingSoon = app.available === false;
        const appInstalled = isInstalled(app);
        body.innerHTML = `
            <section class="orbit-detail" data-orbit-app="${app.id}">
                <button type="button" class="orbit-detail__back" data-orbit-back aria-label="Retour au catalogue">${icon("previous")}<span>Retour au catalogue</span></button>
                <header class="orbit-detail__hero">
                    <div class="orbit-detail__logo">${icon(app.icon)}</div>
                    <div class="orbit-detail__heading">
                        <h2>${escapeHtml(app.name)}</h2>
                        <p><span>${escapeHtml(app.category)}</span><i></i><span>${escapeHtml(statusLabel(app))}</span></p>
                    </div>
                    <div class="orbit-detail__actions">
                        ${appInstalled && !comingSoon && app.action !== "harmonix" ? `<button type="button" class="orbit-detail__uninstall" data-orbit-uninstall="${app.id}" title="Désinstaller ${escapeHtml(app.name)}">${icon("trash")}<span>Désinstaller</span></button>` : ""}
                        <button type="button" class="orbit-detail__install" data-orbit-action="${app.id}" ${comingSoon ? "disabled" : ""}>${icon(comingSoon ? "luma" : app.action && appInstalled ? "play" : "plus")}<span>${actionLabel(app)}</span></button>
                    </div>
                </header>
                <div class="orbit-detail__grid">
                    <div class="orbit-detail__main">
                        <h3>À propos</h3>
                        <p>${escapeHtml(app.descriptionLongue || app.description)}</p>
                    </div>
                    <aside class="orbit-detail__facts">
                        <h3>Détails</h3>
                        <dl>
                            <div><dt>Écosystème</dt><dd>LUMA</dd></div>
                            <div><dt>Catégorie</dt><dd>${escapeHtml(app.category)}</dd></div>
                            <div><dt>Disponibilité</dt><dd>${escapeHtml(statusLabel(app))}</dd></div>
                            <div><dt>Identité</dt><dd>Session Luma OS</dd></div>
                        </dl>
                    </aside>
                </div>
            </section>`;
        body.scrollTop = 0;
    }

    function render() {
        if (selected) renderDetail();
        else renderList();
    }

    function performAction(app) {
        if (app.available === false) return;
        if (app.action === "settings") { open("settings"); return; }
        if (app.action === "harmonix") {
            harmonixEnabled = !harmonixEnabled;
            localStorage.setItem("luma.harmonix.enabled", String(harmonixEnabled));
            window.dispatchEvent(new CustomEvent("luma:harmonix-enabled", { detail: { enabled: harmonixEnabled } }));
            render();
            toast?.(`Harmonix a été ${harmonixEnabled ? "activé" : "désactivé"}.`);
            return;
        }
        if (app.action && isInstalled(app)) { open(app.action); return; }
        installed.has(app.id) ? installed.delete(app.id) : installed.add(app.id);
        localStorage.setItem("luma.orbit.installed", JSON.stringify([...installed]));
        window.dispatchEvent(new CustomEvent("luma:apps-changed"));
        render();
        toast?.(`${app.name} ${installed.has(app.id) ? "est maintenant installée" : "a été retirée de l’écosystème"}.`);
    }

    function uninstall(app) {
        if (app.available === false || !isInstalled(app)) return;
        installed.delete(app.id);
        localStorage.setItem("luma.orbit.installed", JSON.stringify([...installed]));
        window.dispatchEvent(new CustomEvent("luma:apps-changed"));
        render();
        toast?.(`${app.name} a été désinstallée.`);
    }

    const onInput = () => { query = search.value.trim().toLocaleLowerCase("fr"); if (!selected) renderList(); };
    const onKeydown = (event) => {
        const row = event.target.closest("[data-orbit-open]");
        if (row && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            selected = row.dataset.orbitOpen;
            render();
        }
    };
    const onClick = (event) => {
        const openId = event.target.closest("[data-orbit-open]")?.dataset.orbitOpen;
        const actionId = event.target.closest("[data-orbit-action]")?.dataset.orbitAction;
        const uninstallId = event.target.closest("[data-orbit-uninstall]")?.dataset.orbitUninstall;
        if (event.target.closest("[data-orbit-back]")) { selected = null; render(); return; }
        if (uninstallId) {
            uninstall(catalog.find((item) => item.id === uninstallId));
            return;
        }
        if (actionId) {
            performAction(catalog.find((item) => item.id === actionId));
            return;
        }
        if (openId) {
            selected = openId;
            render();
        }
    };

    search.addEventListener("input", onInput);
    body.addEventListener("click", onClick);
    body.addEventListener("keydown", onKeydown);
    render();
    return () => { search.removeEventListener("input", onInput); body.removeEventListener("click", onClick); body.removeEventListener("keydown", onKeydown); };
}
