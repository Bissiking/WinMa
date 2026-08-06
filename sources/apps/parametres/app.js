import { requestJson, patchJson } from "/assets/javascripts/luma-api.js";

const themes = [
    { id: "light", name: "Clair", description: "Des surfaces lumineuses et chaleureuses." },
    { id: "dark", name: "Sombre", description: "Un bureau feutré pour la basse lumière." },
    { id: "luma", name: "Luma", description: "La profondeur bleue signature de LUMA." },
    { id: "system", name: "Automatique", description: "Suit le thème de votre appareil." }
];
const accents = ["#6d5ee8", "#4776e6", "#20a9ca", "#2eab74", "#e6962f", "#df5f5f", "#d64a9c"];
const wallpapers = [
    { path: "./images/backgrounds/luma-aurora.webp", name: "Luma Aurora", collection: "Luma" },
    ...Array.from({ length: 12 }, (_, index) => ({
        path: `./images/backgrounds/background-${String(index + 1).padStart(2, "0")}.jpg`,
        name: `Fond ${String(index + 1).padStart(2, "0")}`,
        collection: "Full HD"
    })),
    ...Array.from({ length: 4 }, (_, index) => ({
        path: `./images/backgrounds/4K/background-4k-${String(index + 1).padStart(2, "0")}.jpg`,
        name: `Fond 4K ${String(index + 1).padStart(2, "0")}`,
        collection: "4K"
    }))
];
const views = [
    { id: "system", label: "Système", icon: "device", keywords: "appareil stockage version affichage" },
    { id: "personalization", label: "Personnalisation", icon: "luma", keywords: "thème couleur fond densité mouvement" },
    { id: "network", label: "Réseau Luma", icon: "luma-network", keywords: "local modules connexion synchronisation" },
    { id: "account", label: "Compte", icon: "user", keywords: "kyros profil quota langue fuseau synchronisation" }
];
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[character]);
const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;

function formatBytes(value) {
    if (!Number.isFinite(value) || value <= 0) return "0 o";
    const units = ["o", "Ko", "Mo", "Go"];
    let amount = value;
    let index = 0;
    while (amount >= 1024 && index < units.length - 1) { amount /= 1024; index += 1; }
    return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: index > 1 ? 1 : 0 }).format(amount)} ${units[index]}`;
}

function renderShell(root) {
    const navigation = views.map((view) => `<button type="button" data-settings-view="${view.id}" data-search-terms="${view.label} ${view.keywords}">${icon(view.icon)}<span>${view.label}</span></button>`).join("");
    root.innerHTML = `
        <div class="settings-app">
            <aside class="settings-sidebar">
                <label class="settings-search">${icon("search")}<span class="sr-only">Rechercher un paramètre</span><input type="search" placeholder="Rechercher un paramètre"></label>
                <button class="settings-account" type="button" data-settings-view="account">
                    <span class="account-avatar">L</span>
                    <span><strong>Compte LUMA</strong><small>Identité gérée par Kyros</small></span>
                    ${icon("chevron")}
                </button>
                <nav aria-label="Catégories de paramètres">${navigation}</nav>
                <p class="settings-search-empty" hidden>Aucun paramètre ne correspond.</p>
                <p class="settings-sidebar__note">Luma OS partage uniquement les informations que vous autorisez.</p>
            </aside>
            <main class="settings-content">
                <nav class="settings-mobile-nav" aria-label="Catégories de paramètres">${navigation}</nav>
                <div class="settings-view" aria-live="polite"></div>
            </main>
        </div>`;
}

function loadingView() {
    return `<div class="settings-skeleton" aria-label="Chargement"><i></i><i></i><i></i><i></i></div>`;
}

function heading(title, description) {
    return `<header class="settings-heading"><div><h1>${title}</h1><p>${description}</p></div><p class="settings-status" role="status" aria-live="polite"></p></header>`;
}

function storageBlock(storage) {
    const used = storage?.usedBytes || 0;
    const quota = storage?.quotaBytes || 1073741824;
    const percent = Math.min(100, used / quota * 100);
    return `<div class="settings-storage">
        <div><strong>${formatBytes(used)} utilisés</strong><span>${formatBytes(Math.max(0, quota - used))} disponibles sur 1 Go</span></div>
        <div class="settings-storage__track"><i style="transform:scaleX(${percent / 100})"></i></div>
        <small>Les éléments de la Corbeille occupent de l’espace jusqu’à leur suppression définitive.</small>
    </div>`;
}

function renderPersonalization(settings) {
    return `${heading("Personnalisation", "Façonnez un bureau qui vous ressemble.")}
        <section class="settings-section" aria-labelledby="theme-heading">
            <div class="settings-section__heading"><h2 id="theme-heading">Thème</h2><p>L’interface change instantanément, sans modifier vos applications.</p></div>
            <div class="theme-options">${themes.map((theme) => `<button class="theme-option" type="button" data-theme-value="${theme.id}"><span class="theme-preview theme-preview--${theme.id}"><i></i><i></i><i></i></span><span><strong>${theme.name}</strong><small>${theme.description}</small></span></button>`).join("")}</div>
        </section>
        <section class="settings-section" aria-labelledby="accent-heading">
            <div class="settings-section__heading"><h2 id="accent-heading">Couleur d’accentuation</h2><p>Utilisée pour la sélection, le focus et les états actifs.</p></div>
            <div class="accent-options">${accents.map((accent) => `<button type="button" data-accent-value="${accent}" style="--swatch:${accent}" aria-label="Choisir la couleur ${accent}"></button>`).join("")}</div>
        </section>
        <section class="settings-section" aria-labelledby="wallpaper-heading">
            <div class="settings-section__heading"><h2 id="wallpaper-heading">Arrière-plan</h2><p>Une scène LUMA pour donner sa lumière au bureau.</p></div>
            <div class="wallpaper-options">${wallpapers.map((wallpaper) => `<button type="button" data-wallpaper-value="${wallpaper.path}" aria-label="Choisir ${wallpaper.name}, collection ${wallpaper.collection}"><img src="${wallpaper.path}" alt="" loading="lazy" decoding="async"><span>${wallpaper.name}</span>${wallpaper.collection === "4K" ? "<small>4K</small>" : ""}</button>`).join("")}</div>
        </section>
        <section class="settings-section" aria-labelledby="comfort-heading">
            <div class="settings-section__heading"><h2 id="comfort-heading">Confort d’utilisation</h2><p>Ajustez la densité et le mouvement sans changer la structure du bureau.</p></div>
            <div class="comfort-settings">
                <div><span>Densité</span><div class="segmented-control"><button type="button" data-setting="density" data-value="comfortable">Confortable</button><button type="button" data-setting="density" data-value="compact">Compacte</button></div></div>
                <div><span>Mouvement</span><div class="segmented-control"><button type="button" data-setting="motion" data-value="full">Complet</button><button type="button" data-setting="motion" data-value="reduced">Réduit</button><button type="button" data-setting="motion" data-value="system">Automatique</button></div></div>
            </div>
        </section>`;
}

function browserName() {
    const agent = navigator.userAgent;
    if (agent.includes("Edg/")) return "Microsoft Edge";
    if (agent.includes("Chrome/")) return "Google Chrome";
    if (agent.includes("Firefox/")) return "Mozilla Firefox";
    if (agent.includes("Safari/")) return "Safari";
    return "Navigateur web";
}

function renderSystem(account, settings, systemInfo) {
    const platform = navigator.userAgentData?.platform || navigator.platform || "Plateforme web";
    const viewport = `${window.innerWidth} × ${window.innerHeight}`;
    return `${heading("Système", "État de votre environnement Luma OS.")}
        <section class="system-device" aria-label="Cet appareil">
            <span class="system-device__mark">${icon("luma")}</span>
            <div><h2>Luma OS Web</h2><p>${escapeHtml(platform)} · ${escapeHtml(browserName())}</p></div>
            <span class="status-badge status-badge--ok">À jour</span>
        </section>
        <section class="settings-section" aria-labelledby="system-info-heading">
            <div class="settings-section__heading"><h2 id="system-info-heading">Informations système</h2><p>Valeurs détectées localement dans ce navigateur.</p></div>
            <dl class="settings-property-list">
                <div><dt>Version de Luma OS</dt><dd>${escapeHtml(systemInfo?.version || "—")}</dd></div>
                <div><dt>Zone d’affichage</dt><dd>${viewport}</dd></div>
                <div><dt>Contexte sécurisé</dt><dd>${window.isSecureContext ? "Actif" : "Local non chiffré"}</dd></div>
                <div><dt>Thème actif</dt><dd>${escapeHtml(themes.find((theme) => theme.id === settings.theme)?.name || settings.theme)}</dd></div>
                <div><dt>Densité</dt><dd>${settings.density === "compact" ? "Compacte" : "Confortable"}</dd></div>
            </dl>
        </section>
        <section class="settings-section" aria-labelledby="system-storage-heading">
            <div class="settings-section__heading"><h2 id="system-storage-heading">Stockage Documents</h2><p>Quota personnel calculé par le serveur Luma.</p></div>
            ${storageBlock(account.storage)}
        </section>`;
}

function moduleLabel(type) {
    if (type === "internal" || type === "system") return "Module local";
    if (type === "iframe") return "Passerelle web";
    return "Lien externe";
}

function renderNetwork(session, account, applications) {
    const host = window.location.hostname || "localhost";
    const transport = window.location.protocol === "https:" ? "Connexion HTTPS" : "Connexion locale HTTP";
    return `${heading("Réseau Luma", "Reliez les services et modules locaux de votre espace LUMA.")}
        <section class="luma-network-summary">
            <div class="luma-network-orbit" aria-hidden="true">${icon("luma-network")}</div>
            <div><h2>Réseau Luma local</h2><p>Actif sur ${escapeHtml(host)} · ${transport}</p></div>
            <span class="status-badge status-badge--ok">Connecté</span>
        </section>
        <section class="settings-section" aria-labelledby="network-services-heading">
            <div class="settings-section__heading"><h2 id="network-services-heading">Connexions de confiance</h2><p>État réel des services utilisés par cette session.</p></div>
            <div class="connection-list">
                <div><span class="connection-icon">${icon("user")}</span><span><strong>Identité Kyros</strong><small>${session.authenticated ? `Session active pour ${escapeHtml(session.user?.username)}` : "Session indisponible"}</small></span><span class="connection-state">${session.authenticated ? "Active" : "Erreur"}</span></div>
                <div><span class="connection-icon">${icon("folder")}</span><span><strong>Documents Luma</strong><small>${formatBytes(account.storage?.availableBytes || 0)} disponibles</small></span><span class="connection-state">Local</span></div>
                <div><span class="connection-icon">${icon("sync")}</span><span><strong>Contexte partagé</strong><small>Profil ${account.preferences.syncProfile ? "autorisé" : "désactivé"}, apparence ${account.preferences.syncAppearance ? "autorisée" : "désactivée"}</small></span><span class="connection-state">Contrôlé</span></div>
            </div>
        </section>
        <section class="settings-section" aria-labelledby="network-modules-heading">
            <div class="settings-section__heading"><h2 id="network-modules-heading">Modules disponibles</h2><p>Applications déclarées par le registre sécurisé de Luma OS.</p></div>
            <div class="module-list">${applications.map((app) => `<div><span class="module-mark">${icon("luma-network")}</span><span><strong>${escapeHtml(app.name)}</strong><small>${moduleLabel(app.type)}</small></span><span class="status-dot" aria-label="Disponible"></span></div>`).join("") || `<p class="settings-inline-empty">Aucun module n’est actuellement déclaré.</p>`}</div>
        </section>`;
}

function timezoneOptions(current) {
    const options = ["auto", Intl.DateTimeFormat().resolvedOptions().timeZone, "Europe/Paris", "UTC"].filter(Boolean);
    return [...new Set([current, ...options])].map((zone) => `<option value="${escapeHtml(zone)}" ${zone === current ? "selected" : ""}>${zone === "auto" ? "Automatique" : escapeHtml(zone)}</option>`).join("");
}

function renderAccount(account) {
    const { identity, preferences, storage, synchronization } = account;
    const effectiveName = preferences.preferredName || identity.displayName;
    return `${heading("Compte", "Gérez ce que Luma OS conserve et partage avec ses modules.")}
        <section class="account-identity">
            <span class="account-avatar account-avatar--large">${escapeHtml(effectiveName.charAt(0).toLocaleUpperCase("fr") || "L")}</span>
            <div><h2>${escapeHtml(effectiveName)}</h2><p>@${escapeHtml(identity.username)} · Identité ${escapeHtml(identity.provider)}</p></div>
            <span class="status-badge">Kyros</span>
        </section>
        <section class="settings-section" aria-labelledby="profile-heading">
            <div class="settings-section__heading"><h2 id="profile-heading">Profil Luma</h2><p>Ces préférences restent locales. Le nom et l’identifiant Kyros sont en lecture seule.</p></div>
            <form class="account-form">
                <label><span>Nom préféré</span><input name="preferredName" maxlength="80" value="${escapeHtml(preferences.preferredName)}" placeholder="${escapeHtml(identity.displayName)}"></label>
                <div class="account-form__row">
                    <label><span>Langue</span><select name="language"><option value="fr-FR" ${preferences.language === "fr-FR" ? "selected" : ""}>Français</option><option value="en-US" ${preferences.language === "en-US" ? "selected" : ""}>English</option></select></label>
                    <label><span>Fuseau horaire</span><select name="timeZone">${timezoneOptions(preferences.timeZone)}</select></label>
                </div>
                <div class="sync-preferences">
                    <label><span><strong>Partager le profil Luma</strong><small>Nom préféré, langue et fuseau pour les modules internes.</small></span><input type="checkbox" name="syncProfile" ${preferences.syncProfile ? "checked" : ""}></label>
                    <label><span><strong>Synchroniser l’apparence</strong><small>Thème, accent, densité et mouvement pour les modules compatibles.</small></span><input type="checkbox" name="syncAppearance" ${preferences.syncAppearance ? "checked" : ""}></label>
                </div>
                <div class="account-form__actions"><span>${synchronization.availableModules} module${synchronization.availableModules > 1 ? "s" : ""} local${synchronization.availableModules > 1 ? "aux" : ""} compatible${synchronization.availableModules > 1 ? "s" : ""}</span><button class="settings-primary-button" type="submit">Enregistrer</button></div>
            </form>
        </section>
        <section class="settings-section" aria-labelledby="account-storage-heading">
            <div class="settings-section__heading"><h2 id="account-storage-heading">Quota personnel</h2><p>Votre espace Documents suit votre sujet Kyros, pas le nom affiché.</p></div>
            ${storageBlock(storage)}
        </section>`;
}

function updateSelection(root, settings) {
    root.querySelectorAll("[data-theme-value]").forEach((button) => button.classList.toggle("is-selected", button.dataset.themeValue === settings.theme));
    root.querySelectorAll("[data-accent-value]").forEach((button) => button.classList.toggle("is-selected", button.dataset.accentValue.toLowerCase() === settings.accentColor.toLowerCase()));
    root.querySelectorAll("[data-wallpaper-value]").forEach((button) => button.classList.toggle("is-selected", button.dataset.wallpaperValue === settings.wallpaper));
    root.querySelectorAll("[data-setting]").forEach((button) => button.classList.toggle("is-selected", settings[button.dataset.setting] === button.dataset.value));
}

export async function mount(root, { toast }) {
    renderShell(root);
    const viewRoot = root.querySelector(".settings-view");
    const search = root.querySelector(".settings-search input");
    let currentView = "personalization";
    let settings = await requestJson("/api/users/me/settings");
    let account;
    let session;
    let applications;
    let systemInfo;

    async function getAccount() { return account || (account = await requestJson("/api/users/me/account")); }
    async function getSession() { return session || (session = await requestJson("/api/session")); }
    async function getApplications() { return applications || (applications = await requestJson("/api/apps")); }
    async function getSystemInfo() { return systemInfo || (systemInfo = await requestJson("/api/health")); }

    function setStatus(message) {
        const status = viewRoot.querySelector(".settings-status");
        if (status) status.textContent = message;
    }

    function resetViewScroll() {
        const content = root.querySelector(".settings-content");
        const windowContent = root.closest(".window-content");
        if (content) content.scrollTop = 0;
        if (windowContent) windowContent.scrollTop = 0;
    }

    async function showView(view) {
        currentView = view;
        root.querySelectorAll("[data-settings-view]").forEach((button) => button.classList.toggle("is-current", button.dataset.settingsView === view));
        viewRoot.innerHTML = loadingView();
        try {
            if (view === "personalization") {
                viewRoot.innerHTML = renderPersonalization(settings);
                updateSelection(root, settings);
            } else if (view === "system") {
                const data = await Promise.all([getAccount(), getSystemInfo()]);
                viewRoot.innerHTML = renderSystem(data[0], settings, data[1]);
            } else if (view === "network") {
                const data = await Promise.all([getSession(), getAccount(), getApplications()]);
                viewRoot.innerHTML = renderNetwork(...data);
            } else if (view === "account") {
                viewRoot.innerHTML = renderAccount(await getAccount());
            }
            resetViewScroll();
            viewRoot.focus({ preventScroll: true });
        } catch (error) {
            viewRoot.innerHTML = `<div class="settings-error"><h2>Cette section est indisponible</h2><p>${escapeHtml(error.message)}</p><button type="button" data-settings-retry>Réessayer</button></div>`;
        }
    }

    async function saveSetting(patch, control) {
        const previous = settings;
        settings = { ...settings, ...patch };
        updateSelection(root, settings);
        window.dispatchEvent(new CustomEvent("luma:settings", { detail: settings }));
        setStatus("Enregistrement…");
        control.disabled = true;
        try {
            settings = await patchJson("/api/users/me/settings", patch);
            updateSelection(root, settings);
            setStatus("Enregistré");
        } catch (error) {
            settings = previous;
            updateSelection(root, settings);
            window.dispatchEvent(new CustomEvent("luma:settings", { detail: settings }));
            setStatus("Modification annulée");
            toast(error.message);
        } finally { control.disabled = false; }
    }

    async function submitAccount(form) {
        const submit = form.querySelector('button[type="submit"]');
        submit.disabled = true;
        submit.textContent = "Enregistrement…";
        try {
            account = await patchJson("/api/users/me/account", {
                preferredName: form.elements.preferredName.value,
                language: form.elements.language.value,
                timeZone: form.elements.timeZone.value,
                syncProfile: form.elements.syncProfile.checked,
                syncAppearance: form.elements.syncAppearance.checked
            });
            viewRoot.innerHTML = renderAccount(account);
            resetViewScroll();
            setStatus("Enregistré");
            const name = account.preferences.preferredName || account.identity.displayName;
            root.querySelector(".settings-account strong").textContent = name;
            root.querySelector(".settings-account .account-avatar").textContent = name.charAt(0).toLocaleUpperCase("fr") || "L";
            toast("Préférences du compte enregistrées.");
        } catch (error) {
            submit.disabled = false;
            submit.textContent = "Enregistrer";
            toast(error.message);
        }
    }

    const click = (event) => {
        const navigation = event.target.closest("[data-settings-view]");
        const theme = event.target.closest("[data-theme-value]");
        const accent = event.target.closest("[data-accent-value]");
        const wallpaper = event.target.closest("[data-wallpaper-value]");
        const preference = event.target.closest("[data-setting]");
        if (navigation) showView(navigation.dataset.settingsView);
        else if (event.target.closest("[data-settings-retry]")) showView(currentView);
        else if (theme) saveSetting({ theme: theme.dataset.themeValue }, theme);
        else if (accent) saveSetting({ accentColor: accent.dataset.accentValue }, accent);
        else if (wallpaper) saveSetting({ wallpaper: wallpaper.dataset.wallpaperValue }, wallpaper);
        else if (preference) saveSetting({ [preference.dataset.setting]: preference.dataset.value }, preference);
    };
    const submit = (event) => {
        if (!event.target.matches(".account-form")) return;
        event.preventDefault();
        submitAccount(event.target);
    };
    const input = () => {
        const query = search.value.trim().toLocaleLowerCase("fr");
        let visible = 0;
        root.querySelectorAll(".settings-sidebar nav [data-search-terms]").forEach((button) => {
            button.hidden = Boolean(query) && !button.dataset.searchTerms.toLocaleLowerCase("fr").includes(query);
            if (!button.hidden) visible += 1;
        });
        root.querySelector(".settings-search-empty").hidden = visible > 0;
    };

    root.addEventListener("click", click);
    root.addEventListener("submit", submit);
    search.addEventListener("input", input);
    getSession().then((data) => {
        const name = data.user?.displayName || data.user?.username || "Compte LUMA";
        root.querySelector(".settings-account strong").textContent = name;
        root.querySelector(".settings-account .account-avatar").textContent = name.charAt(0).toLocaleUpperCase("fr") || "L";
    }).catch(() => {});
    await showView(currentView);
    return () => {
        root.removeEventListener("click", click);
        root.removeEventListener("submit", submit);
        search.removeEventListener("input", input);
    };
}
