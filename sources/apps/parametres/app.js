import { requestJson, patchJson } from "/assets/javascripts/luma-api.js";
import { avatarMarkup, hydrateAvatars } from "/assets/javascripts/luma-avatar.js";

const themes = [
    { id: "light", name: "Clair", description: "Des surfaces lumineuses et chaleureuses." },
    { id: "dark", name: "Sombre", description: "Un bureau feutré pour la basse lumière." },
    { id: "luma", name: "Luma", description: "La profondeur bleue signature de LUMA." },
    { id: "system", name: "Automatique", description: "Suit le thème de votre appareil." }
];
const accents = ["#6d5ee8", "#4776e6", "#20a9ca", "#2eab74", "#e6962f", "#df5f5f", "#d64a9c"];
const wallpapers = [
    ...Array.from({ length: 13 }, (_, index) => ({
        path: `./images/backgrounds/background-${String(index).padStart(2, "0")}.jpg`,
        name: `Fond ${String(index).padStart(2, "0")}`,
        collection: index === 0 ? "Défaut" : "Full HD"
    })),
    ...Array.from({ length: 4 }, (_, index) => ({
        path: `./images/backgrounds/4K/background-4k-${String(index + 1).padStart(2, "0")}.jpg`,
        name: `Fond 4K ${String(index + 1).padStart(2, "0")}`,
        collection: "4K"
    }))
];
const views = [
    { id: "home", label: "Accueil", icon: "luma", keywords: "accueil démarrer catégories" },
    { id: "system", label: "Système", icon: "device", keywords: "appareil version affichage" },
    { id: "update", label: "Mise à jour", icon: "update", keywords: "mise à jour version build service worker installation installateur" },
    { id: "personalization", label: "Personnalisation", icon: "luma", keywords: "thème couleur fond densité mouvement" },
    { id: "storage", label: "Stockage", icon: "folder", keywords: "espace quota corbeille images vidéos musique documents" },
    { id: "startup", label: "Démarrage", icon: "power", keywords: "réouverture applications session démarrage" },
    { id: "network", label: "Réseau Luma", icon: "luma-network", keywords: "local modules connexion synchronisation" },
    { id: "account", label: "Compte", icon: "user", keywords: "kyros profil quota langue fuseau synchronisation" }
];
const homeCards = [
    { id: "system", title: "Système", description: "État de votre environnement Luma OS", icon: "device" },
    { id: "update", title: "Mise à jour", description: "Version installée, version disponible et périmètre", icon: "update" },
    { id: "personalization", title: "Personnalisation", description: "Thème, couleurs, arrière-plan et confort", icon: "luma" },
    { id: "storage", title: "Stockage", description: "Espace Documents, répartition et Corbeille", icon: "folder" },
    { id: "startup", title: "Démarrage", description: "Applications réouvertes au lancement", icon: "power" },
    { id: "network", title: "Réseau Luma", description: "Services, modules et synchronisation", icon: "luma-network" },
    { id: "account", title: "Compte", description: "Identité Kyros, quota et préférences", icon: "user" }
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

function renderSystem(settings, systemInfo) {
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
        </section>`;
}

const UPDATE_PHASE_META = {
    idle: { label: "En attente", badge: "muted" },
    checking: { label: "Recherche en cours", badge: "muted" },
    available: { label: "Mise à jour disponible", badge: "warning" },
    updating: { label: "Installation en cours", badge: "warning" },
    error: { label: "Échec de l’installation", badge: "error" },
    "up-to-date": { label: "À jour", badge: "ok" },
    unsupported: { label: "Non pris en charge", badge: "error" }
};

function shortBuild(build) {
    return typeof build === "string" && build.length ? build.slice(0, 12) : "—";
}

function formatCheckTime(value) {
    if (!value) return "Jamais";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function updateApplications(registry) {
    return (registry || []).filter((app) => String(app.module || "").startsWith("/apps/"));
}

function renderUpdate(detail, systemInfo, registry) {
    const meta = UPDATE_PHASE_META[detail.phase] || UPDATE_PHASE_META.idle;
    const installed = detail.currentVersion;
    const available = detail.targetVersion;
    const pending = Boolean(detail.waiting) || Boolean(installed && available && installed !== available);
    const applications = updateApplications(registry);
    const assets = detail.assets || [];
    const canInstall = pending && !detail.confirmed && !detail.reloading;
    const applyLabel = detail.reloading ? "Redémarrage…"
        : detail.confirmed ? "Installation en cours…"
            : pending ? "Installer la mise à jour"
                : "Luma OS est à jour";
    return `${heading("Mise à jour", "Version installée, version disponible et périmètre de la mise à jour.")}
        <section class="settings-section" aria-labelledby="update-state-heading">
            <div class="system-device">
                <span class="system-device__mark">${icon("update")}</span>
                <div>
                    <h2 id="update-state-heading">${escapeHtml(systemInfo?.version ? `Luma OS ${systemInfo.version}` : "Luma OS")}</h2>
                    <p>Build ${escapeHtml(shortBuild(installed))} · ${escapeHtml(meta.label)}</p>
                </div>
                <span class="status-badge status-badge--${meta.badge}">${escapeHtml(meta.label)}</span>
            </div>
            <div class="update-actions">
                <button type="button" class="settings-primary-button" data-update-apply ${canInstall ? "" : "disabled"}>
                    ${icon("update")}<span>${escapeHtml(applyLabel)}</span>
                </button>
                <button type="button" class="settings-secondary-button" data-update-check ${detail.phase === "updating" ? "disabled" : ""}>
                    ${icon("refresh")}<span>Rechercher</span>
                </button>
            </div>
            <p class="update-note">La mise à jour remplace le Service Worker qui fournit Luma OS et son cache hors ligne. Rien n’est installé sans votre confirmation.</p>
        </section>
        <section class="settings-section" aria-labelledby="update-versions-heading">
            <div class="settings-section__heading"><h2 id="update-versions-heading">Versions</h2><p>Comparaison entre le bundle exécuté et celui publié par le serveur.</p></div>
            <dl class="settings-property-list">
                <div><dt>Version de Luma OS</dt><dd>${escapeHtml(systemInfo?.version || "—")}</dd></div>
                <div><dt>Build installé</dt><dd>${escapeHtml(shortBuild(installed))}</dd></div>
                <div><dt>Build disponible</dt><dd>${escapeHtml(shortBuild(available))}</dd></div>
                <div><dt>Service worker</dt><dd>${detail.hasRegistration ? (detail.waiting ? "Nouvelle version en attente d’activation" : "Actif") : "Non enregistré"}</dd></div>
                <div><dt>Dernière vérification</dt><dd>${escapeHtml(formatCheckTime(detail.lastCheckedAt))}</dd></div>
            </dl>
        </section>
        <section class="settings-section" aria-labelledby="update-apps-heading">
            <div class="settings-section__heading"><h2 id="update-apps-heading">Applications servies par le Service Worker</h2><p>Chargées en réseau d’abord, puis conservées localement pour le mode hors ligne.</p></div>
            <div class="connection-list">
                ${applications.map((app) => `<div>
                    <span class="connection-icon">${icon(app.icon || "luma")}</span>
                    <span><strong>${escapeHtml(app.name)}</strong><small>${escapeHtml(app.module)}</small></span>
                    <span class="connection-state">Réseau d’abord</span>
                </div>`).join("") || `<p class="settings-inline-empty">Aucune application locale n’est déclarée.</p>`}
            </div>
        </section>
        <section class="settings-section" aria-labelledby="update-cache-heading">
            <div class="settings-section__heading"><h2 id="update-cache-heading">Ressources mises en cache</h2><p>Emplacements préchargés par le Service Worker pour le démarrage et le hors ligne.</p></div>
            <ul class="update-assets">${assets.map((asset) => `<li><code>${escapeHtml(asset)}</code></li>`).join("") || `<li class="settings-inline-empty">Le manifeste de précache n’a pas pu être lu.</li>`}</ul>
        </section>`;
}

const STORAGE_CATEGORY_META = {
    image: { label: "Images", icon: "image" },
    video: { label: "Vidéos", icon: "video" },
    audio: { label: "Musique", icon: "music" },
    document: { label: "Documents", icon: "notepad" },
    other: { label: "Autres fichiers", icon: "folder" }
};

function renderStorage(stats) {
    const rows = (stats?.categories || []).map((entry) => {
        const meta = STORAGE_CATEGORY_META[entry.category] || STORAGE_CATEGORY_META.other;
        return `<div>
            <span class="connection-icon">${icon(meta.icon)}</span>
            <span><strong>${meta.label}</strong><small>${entry.count} élément${entry.count > 1 ? "s" : ""}</small></span>
            <span class="connection-state connection-amount">${formatBytes(entry.bytes)}</span>
        </div>`;
    }).join("");
    const trash = stats?.trash || { count: 0, bytes: 0 };
    return `${heading("Stockage", "Répartition de votre espace Documents personnel.")}
        <section class="settings-section" aria-labelledby="storage-quota-heading">
            <div class="settings-section__heading"><h2 id="storage-quota-heading">Espace utilisé</h2><p>Quota personnel calculé par le serveur Luma (1 Go).</p></div>
            ${storageBlock(stats?.storage)}
        </section>
        <section class="settings-section" aria-labelledby="storage-breakdown-heading">
            <div class="settings-section__heading"><h2 id="storage-breakdown-heading">Répartition par type</h2><p>Classement des fichiers hors Corbeille par catégorie de contenu.</p></div>
            <div class="connection-list">${rows || `<p class="settings-inline-empty">Aucun fichier n’occupe votre espace pour le moment.</p>`}</div>
        </section>
        <section class="settings-section" aria-labelledby="storage-trash-heading">
            <div class="settings-section__heading"><h2 id="storage-trash-heading">Corbeille</h2><p>Les éléments supprimés restent récupérables pendant 30 jours.</p></div>
            <div class="connection-list">
                <div>
                    <span class="connection-icon">${icon("trash")}</span>
                    <span><strong>Corbeille</strong><small>${trash.count} élément${trash.count > 1 ? "s" : ""}</small></span>
                    <span class="connection-state connection-amount">${formatBytes(trash.bytes)}</span>
                </div>
            </div>
        </section>`;
}

function moduleLabel(type) {
    if (type === "internal" || type === "system") return "Module local";
    if (type === "iframe") return "Passerelle web";
    return "Lien externe";
}

function serviceStateLabel(service) {
    if (service.status === "ok") return "OK";
    if (service.status === "error") return "Erreur";
    return "Non configuré";
}

function serviceStateClass(service) {
    if (service.status === "ok") return "status-dot status-dot--ok";
    if (service.status === "error") return "status-dot status-dot--error";
    return "status-dot status-dot--muted";
}

function clientNetworkInfo() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const online = navigator.onLine;
    if (!connection) {
        return { online, lines: [{ label: "État", value: online ? "En ligne" : "Hors ligne" }, { label: "Liaison", value: "Non communiqué par le navigateur" }] };
    }
    const typeLabel = connection.type && connection.type !== "unknown" ? connection.type : null;
    return {
        online,
        lines: [
            { label: "État", value: online ? "En ligne" : "Hors ligne" },
            { label: "Type de liaison", value: typeLabel || connection.effectiveType?.toUpperCase() || "Non communiqué par le navigateur" },
            { label: "Latence estimée", value: Number.isFinite(connection.rtt) ? `${connection.rtt} ms` : "Non communiquée" },
            { label: "Débit estimé", value: Number.isFinite(connection.downlink) ? `${connection.downlink} Mb/s` : "Non communiqué" }
        ]
    };
}

function formatAge(seconds) {
    if (!Number.isFinite(seconds)) return "—";
    if (seconds < 60) return `${seconds} s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min`;
    return `${Math.floor(seconds / 3600)} h ${Math.floor((seconds % 3600) / 60)} min`;
}

function renderNetwork(network, session, account, applications) {
    const host = window.location.hostname || "localhost";
    const transport = window.location.protocol === "https:" ? "Connexion HTTPS" : "Connexion locale HTTP";
    const sessionInfo = network?.session || {};
    const expiry = sessionInfo.accessTokenExpiresAt
        ? new Date(sessionInfo.accessTokenExpiresAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
        : "—";
    const services = (network?.services || []).map((service) => `
        <div>
            <span class="connection-icon">${icon(service.id === "kyros" ? "user" : service.id === "harmonix" ? "music" : service.id === "braindump" ? "notepad" : "luma-network")}</span>
            <span><strong>${escapeHtml(service.name)}</strong><small>${service.configured ? (Number.isFinite(service.latencyMs) ? `Latence ${service.latencyMs} ms` : "Sans latence mesurée") : "Aucune URL configurée"}</small></span>
            <span class="connection-state">${serviceStateLabel(service)} <i class="${serviceStateClass(service)}" aria-hidden="true"></i></span>
        </div>`).join("");
    const device = clientNetworkInfo();
    const deviceLines = device.lines.map((line) => `<div><dt>${line.label}</dt><dd>${escapeHtml(line.value)}</dd></div>`).join("");
    return `${heading("Réseau Luma", "Reliez les services et modules locaux de votre espace LUMA.")}
        <section class="luma-network-summary">
            <div class="luma-network-orbit" aria-hidden="true">${icon("luma-network")}</div>
            <div><h2>Réseau Luma local</h2><p>Actif sur ${escapeHtml(host)} · ${transport}</p></div>
            <span class="status-badge status-badge--${sessionInfo.authenticated ? "ok" : "error"}">${sessionInfo.authenticated ? "Connecté" : "Session inactive"}</span>
        </section>
        <section class="settings-section" aria-labelledby="network-session-heading">
            <div class="settings-section__heading"><h2 id="network-session-heading">Session en cours</h2><p>Identité et jetons de cette connexion.</p>
                <button type="button" class="settings-secondary-button" data-network-refresh>${icon("refresh")}<span>Actualiser</span></button>
            </div>
            <dl class="settings-property-list">
                <div><dt>Utilisateur</dt><dd>${sessionInfo.authenticated ? escapeHtml(session.user?.displayName || session.user?.username || "—") : "Non authentifié"}</dd></div>
                <div><dt>Hôte</dt><dd>${escapeHtml(sessionInfo.host || host)}</dd></div>
                <div><dt>Transport</dt><dd>${escapeHtml(sessionInfo.protocol || "http")}</dd></div>
                <div><dt>Âge de la session</dt><dd>${formatAge(sessionInfo.ageSeconds)}</dd></div>
                <div><dt>Jeton d’accès expire à</dt><dd>${escapeHtml(expiry)}</dd></div>
                <div><dt>Jeton de rafraîchissement</dt><dd>${sessionInfo.refreshTokenPresent ? "Présent" : "Absent"}</dd></div>
            </dl>
        </section>
        <section class="settings-section" aria-labelledby="network-services-heading">
            <div class="settings-section__heading"><h2 id="network-services-heading">Connexions de confiance</h2><p>État réel des services utilisés par cette session.</p></div>
            <div class="connection-list">${services || `<p class="settings-inline-empty">Aucun service n’est déclaré.</p>`}</div>
        </section>
        <section class="settings-section" aria-labelledby="network-device-heading">
            <div class="settings-section__heading"><h2 id="network-device-heading">Cet appareil</h2><p>Réseau du navigateur, mesuré côté client.</p></div>
            <dl class="settings-property-list">${deviceLines}</dl>
        </section>
        <section class="settings-section" aria-labelledby="network-documents-heading">
            <div class="connection-list">
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

function renderAccount(account, avatarUrl) {
    const { identity, preferences, storage, synchronization } = account;
    const effectiveName = preferences.preferredName || identity.displayName;
    return `${heading("Compte", "Gérez ce que Luma OS conserve et partage avec ses modules.")}
        <section class="account-identity">
            ${avatarMarkup(avatarUrl, effectiveName, { className: "account-avatar account-avatar--large" })}
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

function renderHome(settings) {
    const cards = homeCards.map((card) => `
        <button class="settings-home-card" type="button" data-settings-view="${card.id}">
            <span class="settings-home-card__icon">${icon(card.icon)}</span>
            <span class="settings-home-card__text"><strong>${card.title}</strong><small>${card.description}</small></span>
            <span class="settings-home-card__chevron">${icon("chevron")}</span>
        </button>`).join("");
    return `<div class="settings-home">
        <header class="settings-home__header">
            <span class="settings-home__logo">${icon("luma")}</span>
            <div><h1>Paramètres Luma</h1><p>Choisissez une catégorie pour ajuster votre espace LUMA.</p></div>
        </header>
        <div class="settings-home__grid">${cards}</div>
        <div class="settings-home__footer">
            <span>${icon("luma")}</span>
            <p><strong>Luma OS</strong><small>${settings.theme === "system" ? "Thème automatique" : `Thème ${themes.find((theme) => theme.id === settings.theme)?.name || settings.theme}`}</small></p>
        </div>
    </div>`;
}

function startupEligibleApps(registry) {
    return (registry || []).filter((app) => !app.hidden && !app.incompatible && !["trash", "image-viewer", "task-manager"].includes(app.id));
}

function renderStartup(settings, registry) {
    const eligible = startupEligibleApps(registry);
    const selected = new Set(settings.startupApps || []);
    const ordered = [
        ...(settings.startupApps || []).map((id) => eligible.find((app) => app.id === id)).filter(Boolean),
        ...eligible.filter((app) => !selected.has(app.id))
    ];
    const profiles = settings.startupProfiles || {};
    const profileNames = Object.keys(profiles);
    const activeProfile = settings.startupActiveProfile;
    const appRows = ordered.map((app, index) => `
        <label class="startup-app-row">
            <input type="checkbox" data-startup-toggle="${app.id}" ${selected.has(app.id) ? "checked" : ""}>
            <span><strong>${escapeHtml(app.name)}</strong><small>${selected.has(app.id) ? "S’ouvre au démarrage" : "Ne s’ouvre pas"}</small></span>
            <span class="startup-app-row__order">
                <button type="button" data-startup-move="${app.id}" data-direction="up" ${index === 0 || !selected.has(app.id) ? "disabled" : ""} aria-label="Remonter ${escapeHtml(app.name)}">↑</button>
                <button type="button" data-startup-move="${app.id}" data-direction="down" ${index === ordered.length - 1 || !selected.has(app.id) ? "disabled" : ""} aria-label="Descendre ${escapeHtml(app.name)}">↓</button>
            </span>
        </label>`).join("");
    const profileOptions = profileNames.map((name) => `<option value="${escapeHtml(name)}" ${name === activeProfile ? "selected" : ""}>${escapeHtml(name)}</option>`).join("");
    return `${heading("Démarrage", "Décidez de ce qui se rouvre au lancement du bureau.")}
        <section class="settings-section" aria-labelledby="startup-session-heading">
            <div class="settings-section__heading"><h2 id="startup-session-heading">Réouverture des applications</h2><p>Quand vous fermez ou rechargez le bureau, vos fenêtres ouvertes peuvent revenir automatiquement au prochain démarrage.</p></div>
            <label class="settings-toggle-row">
                <span class="settings-toggle-row__text"><strong>Restaurer les applications récemment ouvertes</strong><small>Rouvre vos documents et fenêtres après un rechargement.</small></span>
                <input type="checkbox" data-setting="restoreSession" ${settings.restoreSession !== false ? "checked" : ""}>
                <i class="settings-toggle" aria-hidden="true"></i>
            </label>
        </section>
        <section class="settings-section" aria-labelledby="startup-apps-heading">
            <div class="settings-section__heading"><h2 id="startup-apps-heading">Applications au démarrage</h2><p>Cochez les applications qui s’ouvrent avec votre session. L’ordre ci-dessous définit la séquence.</p></div>
            <div class="startup-list">${appRows || `<p class="settings-inline-empty">Aucune application n’est éligible.</p>`}</div>
        </section>
        <section class="settings-section" aria-labelledby="startup-timing-heading">
            <div class="settings-section__heading"><h2 id="startup-timing-heading">Rythme de lancement</h2><p>Délai entre chaque ouverture et mode de lancement.</p></div>
            <div class="comfort-settings">
                <div><span>Délai entre applications</span><label class="startup-delay-field"><input type="number" min="0" max="5000" step="10" value="${settings.startupDelayMs ?? 90}" data-startup-delay><small>ms</small></label></div>
                <div><span>Mode</span><div class="segmented-control"><button type="button" data-setting="startupMode" data-value="staggered">Progressif</button><button type="button" data-setting="startupMode" data-value="simultaneous">Simultané</button></div></div>
            </div>
        </section>
        <section class="settings-section" aria-labelledby="startup-profiles-heading">
            <div class="settings-section__heading"><h2 id="startup-profiles-heading">Profils de démarrage</h2><p>Enregistrez des combinaisons d’applications et basculez entre elles.</p></div>
            <div class="startup-profiles">
                <select data-profile-select aria-label="Profil actif"><option value="">Aucun profil actif</option>${profileOptions}</select>
                <span class="startup-profiles__actions">
                    <button type="button" class="settings-secondary-button" data-profile-apply ${!activeProfile ? "disabled" : ""}>Appliquer</button>
                    <button type="button" class="settings-secondary-button" data-profile-create>Enregistrer le scénario actuel</button>
                    <button type="button" class="settings-secondary-button" data-profile-rename ${!activeProfile ? "disabled" : ""}>Renommer</button>
                    <button type="button" class="settings-secondary-button" data-profile-delete ${!activeProfile ? "disabled" : ""}>Supprimer</button>
                </span>
            </div>
        </section>
        <section class="settings-section" aria-labelledby="startup-options-heading">
            <div class="settings-section__heading"><h2 id="startup-options-heading">Options</h2><p>Éléments supplémentaires à ouvrir ou restaurer au démarrage.</p></div>
            <div class="sync-preferences">
                <label><span><strong>Ouvrir la Corbeille</strong><small>Affiche la Corbeille au lancement.</small></span><input type="checkbox" data-setting="startupOpenTrash" ${settings.startupOpenTrash ? "checked" : ""}></label>
                <label><span><strong>Ouvrir les Récents</strong><small>La vue Récents de Documents s’ouvre au démarrage.</small></span><input type="checkbox" data-setting="startupOpenRecents" ${settings.startupOpenRecents ? "checked" : ""}></label>
                <label><span><strong>Restaurer le dernier dossier</strong><small>Documents rouvre le dossier dans lequel vous étiez.</small></span><input type="checkbox" data-setting="startupRestoreFolder" ${settings.startupRestoreFolder ? "checked" : ""}></label>
                <label><span><strong>Mode présentation</strong><small>Les fenêtres de démarrage s’ouvrent maximisées.</small></span><input type="checkbox" data-setting="startupPresentation" ${settings.startupPresentation ? "checked" : ""}></label>
            </div>
        </section>`;
}

function updateSelection(root, settings) {
    root.querySelectorAll("[data-theme-value]").forEach((button) => button.classList.toggle("is-selected", button.dataset.themeValue === settings.theme));
    root.querySelectorAll("[data-accent-value]").forEach((button) => button.classList.toggle("is-selected", button.dataset.accentValue.toLowerCase() === settings.accentColor.toLowerCase()));
    root.querySelectorAll("[data-wallpaper-value]").forEach((button) => button.classList.toggle("is-selected", button.dataset.wallpaperValue === settings.wallpaper));
    root.querySelectorAll("[data-setting]").forEach((button) => button.classList.toggle("is-selected", settings[button.dataset.setting] === button.dataset.value));
    root.querySelectorAll('input[type="checkbox"][data-setting]').forEach((input) => {
        if (input.dataset.setting === "restoreSession") input.checked = settings.restoreSession !== false;
        else input.checked = Boolean(settings[input.dataset.setting]);
    });
}

export async function mount(root, { toast, registry, options }) {
    renderShell(root);
    const viewRoot = root.querySelector(".settings-view");
    const search = root.querySelector(".settings-search input");
    let currentView = options?.data?.view || "home";
    let unsubscribeUpdates = null;
    let settings = await requestJson("/api/users/me/settings");
    let account;
    let session;
    let applications;
    let systemInfo;
    let documentStats;
    let network;

    async function getAccount() { return account || (account = await requestJson("/api/users/me/account")); }
    async function getSession() { return session || (session = await requestJson("/api/session")); }
    async function getApplications() { return applications || (applications = await requestJson("/api/apps")); }
    async function getSystemInfo() { return systemInfo || (systemInfo = await requestJson("/api/health")); }
    async function getDocumentStats() { return documentStats || (documentStats = await requestJson("/api/documents/stats")); }
    async function getNetwork({ refresh = false } = {}) {
        if (refresh) network = null;
        return network || (network = await requestJson("/api/system/network"));
    }

    function setStatus(message) {
        const status = viewRoot.querySelector(".settings-status");
        if (status) status.textContent = message;
    }

    async function getUpdateState() {
        const api = window.LumaSwUpdate;
        if (!api?.getState) {
            return { supported: false, phase: "unsupported", hasRegistration: false, assets: null };
        }
        await api.requestAssets?.().catch?.(() => null);
        return (await api.refresh?.()) || api.getState();
    }

    function watchUpdateView() {
        unsubscribeUpdates?.();
        unsubscribeUpdates = null;
        const api = window.LumaSwUpdate;
        if (!api?.subscribe) return;
        unsubscribeUpdates = api.subscribe((detail) => {
            if (currentView !== "update" || !detail.supported) return;
            viewRoot.innerHTML = renderUpdate(detail, systemInfo, registry);
        });
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
            if (view === "home") {
                viewRoot.innerHTML = renderHome(settings);
            } else if (view === "personalization") {
                viewRoot.innerHTML = renderPersonalization(settings);
                updateSelection(root, settings);
            } else if (view === "startup") {
                viewRoot.innerHTML = renderStartup(settings, registry);
                updateSelection(root, settings);
            } else if (view === "system") {
                viewRoot.innerHTML = renderSystem(settings, await getSystemInfo());
            } else if (view === "update") {
                systemInfo = await getSystemInfo();
                viewRoot.innerHTML = renderUpdate(await getUpdateState(), systemInfo, registry);
                watchUpdateView();
            } else if (view === "storage") {
                viewRoot.innerHTML = renderStorage(await getDocumentStats());
            } else if (view === "network") {
                const data = await Promise.all([getNetwork(), getSession(), getAccount(), getApplications()]);
                viewRoot.innerHTML = renderNetwork(...data);
            } else if (view === "account") {
                const [accountData, sessionData] = await Promise.all([getAccount(), getSession()]);
                viewRoot.innerHTML = renderAccount(accountData, sessionData.user?.avatarUrl);
                hydrateAvatars(viewRoot);
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
            viewRoot.innerHTML = renderAccount(account, session?.user?.avatarUrl);
            hydrateAvatars(viewRoot);
            resetViewScroll();
            setStatus("Enregistré");
            const name = account.preferences.preferredName || account.identity.displayName;
            root.querySelector(".settings-account strong").textContent = name;
            const sidebarAvatar = root.querySelector(".settings-account .account-avatar");
            if (sidebarAvatar) {
                sidebarAvatar.outerHTML = avatarMarkup(session?.user?.avatarUrl, name, { className: "account-avatar" });
                hydrateAvatars(root.querySelector(".settings-account"));
            }
            if (account.profileSyncWarning) {
                toast(account.profileSyncWarning);
            } else {
                toast("Préférences du compte enregistrées.");
            }
        } catch (error) {
            submit.disabled = false;
            submit.textContent = "Enregistrer";
            toast(error.message);
        }
    }

    async function saveStartup(patch, control) {
        await saveSetting(patch, control);
        if (currentView === "startup") await showView("startup");
    }

    async function promptProfileName(title, initial = "") {
        return window.prompt(title, initial);
    }

    async function handleProfileAction(action) {
        const profiles = { ...(settings.startupProfiles || {}) };
        const active = settings.startupActiveProfile;
        if (action === "apply") {
            const profile = profiles[active];
            if (!profile) return;
            await saveStartup({ startupApps: [...(profile.apps || [])], startupDelayMs: profile.delayMs, startupMode: profile.mode }, viewRoot.querySelector("[data-profile-apply]"));
            toast(`Profil « ${active} » appliqué.`);
        } else if (action === "create") {
            const name = (await promptProfileName("Nom du profil de démarrage :"))?.trim();
            if (!name) return;
            if (!/^[^\s]{1,40}$/.test(name)) { toast("Le nom du profil ne doit pas contenir d’espace (1 à 40 caractères)."); return; }
            profiles[name] = { apps: [...(settings.startupApps || [])], delayMs: settings.startupDelayMs ?? 90, mode: settings.startupMode || "staggered" };
            await saveStartup({ startupProfiles: profiles, startupActiveProfile: name }, viewRoot.querySelector("[data-profile-create]"));
            toast(`Profil « ${name} » enregistré.`);
        } else if (action === "rename") {
            const profile = profiles[active];
            if (!profile) return;
            const name = (await promptProfileName("Nouveau nom du profil :", active))?.trim();
            if (!name || name === active) return;
            if (!/^[^\s]{1,40}$/.test(name)) { toast("Le nom du profil ne doit pas contenir d’espace (1 à 40 caractères)."); return; }
            delete profiles[active];
            profiles[name] = profile;
            await saveStartup({ startupProfiles: profiles, startupActiveProfile: name }, viewRoot.querySelector("[data-profile-rename]"));
            toast(`Profil renommé « ${name} ».`);
        } else if (action === "delete") {
            if (!active) return;
            delete profiles[active];
            await saveStartup({ startupProfiles: profiles, startupActiveProfile: null }, viewRoot.querySelector("[data-profile-delete]"));
            toast(`Profil « ${active} » supprimé.`);
        }
    }

    const click = (event) => {
        const navigation = event.target.closest("[data-settings-view]");
        const theme = event.target.closest("[data-theme-value]");
        const accent = event.target.closest("[data-accent-value]");
        const wallpaper = event.target.closest("[data-wallpaper-value]");
        const preference = event.target.closest("[data-setting]");
        const move = event.target.closest("[data-startup-move]");
        const profileAction = event.target.closest("[data-profile-apply], [data-profile-create], [data-profile-rename], [data-profile-delete]");
        if (navigation) showView(navigation.dataset.settingsView);
        else if (event.target.closest("[data-settings-retry]")) showView(currentView);
        else if (event.target.closest("[data-network-refresh]")) {
            network = null;
            showView("network");
        }
        else if (event.target.closest("[data-update-check]")) {
            setStatus("Recherche en cours…");
            Promise.resolve(window.LumaSwUpdate?.refresh?.())
                .then(() => window.LumaSwUpdate?.check?.())
                .catch(() => setStatus("Vérification impossible"));
        }
        else if (event.target.closest("[data-update-apply]")) {
            window.LumaSwUpdate?.apply?.();
        }
        else if (move) {
            const list = [...(settings.startupApps || [])];
            const index = list.indexOf(move.dataset.startupMove);
            const target = move.dataset.direction === "up" ? index - 1 : index + 1;
            if (index >= 0 && target >= 0 && target < list.length) {
                [list[index], list[target]] = [list[target], list[index]];
                saveStartup({ startupApps: list }, move);
            }
        }
        else if (profileAction) {
            const action = profileAction.hasAttribute("data-profile-apply") ? "apply"
                : profileAction.hasAttribute("data-profile-create") ? "create"
                    : profileAction.hasAttribute("data-profile-rename") ? "rename" : "delete";
            handleProfileAction(action);
        }
        else if (theme) saveSetting({ theme: theme.dataset.themeValue }, theme);
        else if (accent) saveSetting({ accentColor: accent.dataset.accentValue }, accent);
        else if (wallpaper) saveSetting({ wallpaper: wallpaper.dataset.wallpaperValue }, wallpaper);
        else if (preference && preference.dataset.value) saveSetting({ [preference.dataset.setting]: preference.dataset.value }, preference);
    };
    const change = (event) => {
        const target = event.target;
        if (target.matches("[data-startup-toggle]")) {
            const id = target.dataset.startupToggle;
            const list = [...(settings.startupApps || [])];
            if (target.checked) { if (!list.includes(id)) list.push(id); }
            else { const index = list.indexOf(id); if (index >= 0) list.splice(index, 1); }
            saveStartup({ startupApps: list }, target);
        } else if (target.matches("[data-startup-delay]")) {
            const value = Math.min(5000, Math.max(0, Math.round(Number(target.value) || 0)));
            saveStartup({ startupDelayMs: value }, target);
        } else if (target.matches("[data-profile-select]")) {
            saveStartup({ startupActiveProfile: target.value || null }, target);
        } else if (target.matches('input[type="checkbox"][data-setting]')) {
            saveSetting({ [target.dataset.setting]: target.checked }, target);
        }
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

    const requestView = (event) => {
        const view = event.detail?.view;
        if (view && view !== currentView) showView(view);
    };

    root.addEventListener("click", click);
    root.addEventListener("change", change);
    root.addEventListener("submit", submit);
    search.addEventListener("input", input);
    window.addEventListener("luma:settings-view", requestView);
    getSession().then((data) => {
        const name = data.user?.displayName || data.user?.username || "Compte LUMA";
        root.querySelector(".settings-account strong").textContent = name;
        const sidebarAvatar = root.querySelector(".settings-account .account-avatar");
        if (sidebarAvatar) {
            sidebarAvatar.outerHTML = avatarMarkup(data.user?.avatarUrl, name, { className: "account-avatar" });
            hydrateAvatars(root.querySelector(".settings-account"));
        }
    }).catch(() => {});
    await showView(currentView);
    return () => {
        unsubscribeUpdates?.();
        root.removeEventListener("click", click);
        root.removeEventListener("change", change);
        root.removeEventListener("submit", submit);
        search.removeEventListener("input", input);
        window.removeEventListener("luma:settings-view", requestView);
    };
}
