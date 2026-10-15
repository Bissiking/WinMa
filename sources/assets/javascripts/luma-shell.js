import { requestJson, patchJson, postJson, putJson } from "./luma-api.js";
import { searchApps, searchEvents, searchSettings } from "./luma-search.js";
import { createWindowManager } from "./luma-window-manager.js";
import { showContextMenu } from "./luma-context-menu.js";
import { welcomeMessage } from "./luma-welcome.js";
import { avatarMarkup, hydrateAvatars } from "./luma-avatar.js";
import { setAvatarOwner, clearAvatarCache } from "./luma-avatar-store.js";

// Repli local uniquement : la source de vérité est le registre serveur
// (data/apps.json) servi par GET /api/apps. Chargez ce tableau complet avant
// toute nouvelle application, il ne doit servir qu'au premier rendu et hors ligne.
const fallbackApps = [
    { id: "documents", name: "Documents", taskbarName: "Docs", icon: "documents", type: "system", entry: "/apps/documents/app.js", module: "/apps/documents/app.js", width: 980, height: 700, minWidth: 640, minHeight: 420, position: { left: .28, top: .14 } },
    { id: "calculator", name: "Calculatrice", taskbarName: "Calc.", icon: "calculator", type: "internal", entry: "/apps/calculator/app.js", module: "/apps/calculator/app.js", width: 420, height: 620, minWidth: 340, minHeight: 480, position: { left: .34, top: .1 } },
    { id: "terminal", name: "Terminal", taskbarName: "Term.", icon: "terminal", type: "internal", entry: "/apps/terminal/app.js", module: "/apps/terminal/app.js", width: 760, height: 520, minWidth: 480, minHeight: 320, position: { left: .15, top: .2 } },
    { id: "calendar", name: "Calendrier", taskbarName: "Agenda", icon: "calendar", type: "internal", entry: "/apps/calendar/app.js", module: "/apps/calendar/app.js", width: 940, height: 660, minWidth: 600, minHeight: 460, position: { left: .22, top: .12 } },
    { id: "settings", name: "Paramètres", taskbarName: "Config", icon: "settings", type: "internal", entry: "/apps/parametres/app.js", module: "/apps/parametres/app.js", width: 1040, height: 720, minWidth: 680, minHeight: 440, position: { left: .07, top: .07 } },
    { id: "task-manager", name: "Gestionnaire des tâches", taskbarName: "Tâches", icon: "activity", type: "internal", entry: "/apps/task-manager/app.js", module: "/apps/task-manager/app.js", width: 920, height: 650, minWidth: 660, minHeight: 440, position: { left: .12, top: .08 } },
    { id: "luma-orbit", name: "Luma Orbit", taskbarName: "Orbit", icon: "orbit", type: "internal", entry: "/apps/luma-orbit/app.js", module: "/apps/luma-orbit/app.js", width: 1040, height: 720, minWidth: 680, minHeight: 480, position: { left: .09, top: .06 } },
    { id: "sonora-studio", name: "Sonora Studio", taskbarName: "Sonora", icon: "music", logo: "/images/interface-logo/applications/sonora-studio.svg", type: "internal", entry: "/apps/sonora-studio/app.js", module: "/apps/sonora-studio/app.js", width: 1120, height: 740, minWidth: 700, minHeight: 480, storeManaged: true, incompatible: true, position: { left: .06, top: .04 } },
    { id: "braindump", name: "BrainDump", taskbarName: "Brain", icon: "notepad", logo: "/images/interface-logo/applications/braindump.svg", type: "internal", entry: "/apps/braindump/app.js", module: "/apps/braindump/app.js", width: 1040, height: 700, minWidth: 620, minHeight: 440, storeManaged: true, incompatible: true, position: { left: .1, top: .06 } },
    { id: "matheo-systems", name: "Matheo Systems", taskbarName: "Matheo", icon: "chip", type: "internal", entry: "/apps/matheo-systems/app.js", module: "/apps/matheo-systems/app.js", width: 1060, height: 730, minWidth: 700, minHeight: 500, position: { left: .08, top: .05 }, hidden: true },
    { id: "notepad", name: "Bloc-notes", taskbarName: "Notes", icon: "notepad", type: "internal", entry: "/apps/notepad/app.js", module: "/apps/notepad/app.js", width: 800, height: 640, minWidth: 520, minHeight: 400, position: { left: .18, top: .1 } },
    { id: "image-viewer", name: "Photos Luma", taskbarName: "Photos", icon: "image", type: "internal", entry: "/apps/image-viewer/app.js", module: "/apps/image-viewer/app.js", width: 900, height: 680, minWidth: 480, minHeight: 360, hidden: true, position: { left: .16, top: .08 } },
    { id: "music-player", name: "Lecteur de musique", taskbarName: "Musique", icon: "music", type: "internal", entry: "/apps/music-player/app.js", module: "/apps/music-player/app.js", width: 640, height: 720, minWidth: 420, minHeight: 480, hidden: true, position: { left: .2, top: .06 } },
    { id: "video-player", name: "Lecteur vidéo", taskbarName: "Vidéo", icon: "video", type: "internal", entry: "/apps/video-player/app.js", module: "/apps/video-player/app.js", width: 980, height: 700, minWidth: 560, minHeight: 400, hidden: true, position: { left: .12, top: .08 } },
    { id: "power", name: "Alimentation", taskbarName: "Alim.", icon: "power", type: "internal", entry: "/apps/power/app.js", module: "/apps/power/app.js", width: 480, height: 560, minWidth: 380, minHeight: 420, hidden: true, position: { left: .3, top: .12 } },
    { id: "timer", name: "Minuteur", taskbarName: "Min.", icon: "timer", type: "internal", entry: "/apps/timer/app.js", module: "/apps/timer/app.js", width: 520, height: 620, minWidth: 380, minHeight: 440, position: { left: .32, top: .1 } },
    { id: "trash", name: "Corbeille", taskbarName: "Corb.", icon: "trash", type: "system", entry: "/apps/documents/app.js", module: "/apps/documents/app.js", width: 980, height: 660, minWidth: 620, minHeight: 400 }
];

let apps = [...fallbackApps];

function applyRegistry(entries) {
    const localById = new Map(fallbackApps.map((app) => [app.id, app]));
    apps = entries.map((entry) => {
        const local = localById.get(entry.id) || {};
        return {
            ...local,
            id: entry.id,
            name: entry.name || local.name,
            type: entry.type || local.type,
            icon: entry.icon || local.icon,
            logo: entry.logo || local.logo,
            taskbarName: entry.taskbarName || local.taskbarName,
            entry: entry.entry || local.entry,
            module: entry.module || local.module,
            width: entry.window?.width ?? local.width,
            height: entry.window?.height ?? local.height,
            minWidth: entry.window?.minWidth ?? local.minWidth,
            minHeight: entry.window?.minHeight ?? local.minHeight,
            position: entry.position || local.position,
            hidden: entry.hidden === true,
            storeManaged: entry.storeManaged === true,
            incompatible: entry.incompatible === true
        };
    });
    renderStartResults(document.getElementById("app-search")?.value || "");
}

async function loadRegistryApps() {
    try {
        const entries = await requestJson("/api/apps");
        if (Array.isArray(entries) && entries.length) applyRegistry(entries);
    } catch {
        /* le repli local reste en place : premier rendu et mode hors ligne */
    }
}

const desktop = document.getElementById("luma-desktop");
const sessionRoot = document.getElementById("session-root");
const startPanel = document.getElementById("start-panel");
const launcher = document.getElementById("luma-launcher");
const startApps = document.getElementById("start-apps");
const startHeading = startPanel.querySelector(".start-panel__heading h2");
const toastRegion = document.getElementById("toast-region");
let windowManager;
let currentUser;
let startupLaunched = false;
let restoreSessionEnabled = true;
let currentSettings = null;
let systemVersion = "3.1.0";

// Verrouillage automatique : délai d'inactivité piloté par le paramètre
// lockAfterIdleMs (0 = jamais). La session verrouillée garde le cookie, les
// fenêtres ouvertes et le cache d'avatars ; seule l'écran de session est rendu.
const DEFAULT_LOCK_AFTER_IDLE_MS = 300000;
let lockAfterIdleMs = DEFAULT_LOCK_AFTER_IDLE_MS;
let idleTimer = null;
let lastIdleResetAt = 0;
let locked = false;

// Bascule d'espace de travail : la synchro de disposition est suspendue pendant
// que le serveur applique un autre espace, sinon le debounce (600 ms) réécrirait
// l'ancienne disposition par-dessus la nouvelle au retour du timer.
let suspendSessionSync = false;

// Synchro multi-onglets : verrouillage et déconnexion se propagent à tous les
// onglets du même navigateur. Les sessions serveur multi-appareils sont
// couvertes par le 401 → luma:session-expired (luma-api.js).
const sessionChannel = "BroadcastChannel" in window ? new BroadcastChannel("luma.session") : null;

function iconFor(app) {
    if (app.logo) return `<span class="app-icon app-icon--image-logo"><img src="${app.logo}" alt=""></span>`;
    const symbols = { settings: "settings", trash: "trash", notepad: "notepad", image: "image", activity: "activity", orbit: "orbit", chip: "chip", calculator: "calc", terminal: "terminal", calendar: "calendar", music: "music", video: "video", power: "power", timer: "timer" };
    const symbol = symbols[app.icon] || "folder";
    return `<span class="app-icon app-icon--${app.icon}"><svg class="icon" aria-hidden="true"><use href="#icon-${symbol}"></use></svg></span>`;
}

function toast(message) {
    const element = document.createElement("div");
    element.className = "toast";
    element.textContent = message;
    toastRegion.append(element);
    window.setTimeout(() => element.remove(), 3800);
}

function hexToRgb(hex) {
    const value = hex.replace("#", "");
    return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16)).join(", ");
}

function escapeHtml(text) {
    const element = document.createElement("span");
    element.textContent = String(text ?? "");
    return element.innerHTML;
}

function resolveTheme(theme) {
    if (theme !== "system") return theme;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applySettings(settings) {
    currentSettings = settings;
    restoreSessionEnabled = settings.restoreSession !== false;
    lockAfterIdleMs = Number.isInteger(settings.lockAfterIdleMs) ? settings.lockAfterIdleMs : DEFAULT_LOCK_AFTER_IDLE_MS;
    const theme = resolveTheme(settings.theme || "luma");
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.density = settings.density || "comfortable";
    document.documentElement.dataset.motion = settings.motion === "system"
        ? (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduced" : "full")
        : (settings.motion || "full");
    document.documentElement.style.setProperty("--luma-accent", settings.accentColor || "#6d5ee8");
    document.documentElement.style.setProperty("--luma-accent-rgb", hexToRgb(settings.accentColor || "#6d5ee8"));
    if (settings.wallpaper) document.body.style.backgroundImage = `url("${settings.wallpaper}")`;
    if (!desktop.hidden) armIdleTimer();
}

function setStartPanel(open) {
    const wasOpen = !startPanel.hidden;
    startPanel.hidden = !open;
    launcher.setAttribute("aria-expanded", String(open));
    launcher.setAttribute("aria-pressed", String(open));
    if (open) {
        window.setTimeout(() => document.getElementById("app-search").focus(), 0);
    } else if (wasOpen) {
        // La recherche est réinitialisée entre deux ouvertures : le panneau
        // rouvre sur la grille d'applications, jamais sur d'anciens résultats.
        const input = document.getElementById("app-search");
        window.clearTimeout(documentSearchTimer);
        if (input.value) {
            input.value = "";
            renderStartResults("");
        }
    }
}

function readInstalledApps() {
    try { return new Set(JSON.parse(localStorage.getItem("luma.orbit.installed") || "[]")); } catch { return new Set(); }
}

function readCalendarEvents() {
    try { return JSON.parse(localStorage.getItem("luma.calendar.events") || "[]"); } catch { return []; }
}

// Recherche globale (Ctrl+K) : applications du registre, fichiers Documents
// (serveur, propriétaire de la session), événements du Calendrier et réglages.
// Les résultats Documents sont chargés avec un debounce et un jeton de séquence
// pour ignorer les réponses obsolètes.
let documentResults = [];
let documentSearchToken = 0;
let documentSearchTimer = null;
let searchActiveIndex = -1;

async function loadDocumentResults(query) {
    const trimmed = String(query || "").trim();
    const token = ++documentSearchToken;
    if (trimmed.length < 2) { documentResults = []; return; }
    try {
        const params = new URLSearchParams({ search: trimmed.slice(0, 120) });
        const payload = await requestJson(`/api/documents?${params}`);
        if (token !== documentSearchToken) return;
        documentResults = Array.isArray(payload?.items) ? payload.items.slice(0, 6) : [];
    } catch {
        if (token === documentSearchToken) documentResults = [];
    }
}

function renderStartResults(filter = "") {
    const query = String(filter || "").trim();
    const installed = readInstalledApps();
    const appsFound = searchApps(apps, { query, installed });
    searchActiveIndex = -1;
    startApps.classList.toggle("start-apps--list", Boolean(query));

    if (!query) {
        startHeading.textContent = "Applications";
        startApps.innerHTML = appsFound.length ? appsFound.map((app) => `
            <button class="start-app" type="button" data-open-app="${app.id}">
                ${iconFor(app)}<span>${app.name}</span>
            </button>`).join("") : '<p class="start-empty">Aucune application trouvée.</p>';
        return;
    }

    startHeading.textContent = "Résultats";
    const iconUse = (symbol) => `<svg class="icon" aria-hidden="true"><use href="#icon-${symbol}"></use></svg>`;
    const groups = [];
    if (appsFound.length) groups.push({ title: "Applications", items: appsFound.map((app) => ({
        markup: `${iconFor(app)}<span>${escapeHtml(app.name)}</span><small>Application</small>`,
        attrs: `data-open-app="${app.id}"`
    })) });
    if (documentResults.length) groups.push({ title: "Documents", items: documentResults.map((item) => ({
        markup: `${iconUse("folder")}<span>${escapeHtml(item.name)}</span><small>${item.kind === "folder" ? "Dossier" : "Fichier"}</small>`,
        attrs: `data-open-app="documents" data-open-search="${escapeHtml(query)}"`
    })) });
    const events = searchEvents(readCalendarEvents(), query);
    if (events.length) groups.push({ title: "Événements", items: events.map((event) => ({
        markup: `${iconUse("calendar")}<span>${escapeHtml(event.title)}</span><small>${escapeHtml(event.date || "")}${event.time ? ` ${escapeHtml(event.time)}` : ""}</small>`,
        attrs: `data-open-app="calendar"`
    })) });
    const settingsFound = searchSettings(query);
    if (settingsFound.length) groups.push({ title: "Réglages", items: settingsFound.map((entry) => ({
        markup: `${iconUse("settings")}<span>${escapeHtml(entry.label)}</span><small>Réglage</small>`,
        attrs: `data-open-app="settings" data-open-view="${entry.view}"`
    })) });

    startApps.innerHTML = groups.length
        ? groups.map((group) => `<p class="start-group">${group.title}</p>${group.items.map((item) => `
            <button class="start-app start-app--row" type="button" ${item.attrs}>${item.markup}</button>`).join("")}`).join("")
        : '<p class="start-empty">Aucun résultat.</p>';
}

async function migrateLegacyStartupApps() {
    if (Array.isArray(currentSettings?.startupApps) && currentSettings.startupApps.length) {
        try { localStorage.removeItem("luma.startup-apps"); } catch { /* stockage indisponible */ }
        return;
    }
    let legacy = [];
    try { legacy = JSON.parse(localStorage.getItem("luma.startup-apps") || "[]"); } catch { legacy = []; }
    if (!Array.isArray(legacy) || !legacy.length) return;
    try {
        const settings = await patchJson("/api/users/me/settings", { startupApps: legacy });
        currentSettings = { ...currentSettings, ...settings };
        localStorage.removeItem("luma.startup-apps");
    } catch { /* migration reportée au prochain démarrage */ }
}

function launchStartupApps() {
    if (startupLaunched || !windowManager) return;
    startupLaunched = true;
    const settings = currentSettings || {};
    const profile = settings.startupActiveProfile ? settings.startupProfiles?.[settings.startupActiveProfile] : null;
    const startupIds = Array.isArray(profile?.apps) && profile.apps.length
        ? profile.apps
        : (Array.isArray(settings.startupApps) ? settings.startupApps : []);
    const delay = Number.isInteger(profile?.delayMs) ? profile.delayMs : (Number.isInteger(settings.startupDelayMs) ? settings.startupDelayMs : 90);
    const mode = profile?.mode || settings.startupMode || "staggered";
    const presentation = settings.startupPresentation ? { state: "maximized" } : {};

    const launches = startupIds
        .filter((id) => apps.some((app) => app.id === id && !app.hidden && !app.incompatible))
        .map((id) => () => windowManager.openApp(id, presentation));
    if (settings.startupOpenTrash) launches.push(() => windowManager.openApp("trash", presentation));
    if (settings.startupOpenRecents) {
        launches.push(() => windowManager.openApp("documents", { instanceKey: "documents:recents", title: "Documents", data: { view: "recent" }, ...presentation }));
    }

    launches.forEach((launch, index) => {
        if (mode === "simultaneous") launch();
        else window.setTimeout(launch, index * Math.max(0, delay));
    });
}

function renderSessionScreen({ authenticated = false, authentication = {}, user = null, message = "", unreachable = false } = {}) {
    desktop.hidden = true;
    sessionRoot.hidden = false;
    const available = authenticated || authentication.available;
    let lastUser = user;
    if (!lastUser) {
        try { lastUser = JSON.parse(localStorage.getItem("luma.last-user") || "null"); } catch { lastUser = null; }
    }
    const now = new Date();
    const time = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(now);
    const date = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "2-digit", month: "long" }).format(now);
    const displayName = lastUser?.displayName || lastUser?.username || "Utilisateur Luma";
    const avatarMarkupHtml = avatarMarkup(lastUser?.avatarUrl, displayName, { className: "session-user__avatar" });
    const buttonLabel = authenticated ? "Reprendre la session" : lastUser ? "Se connecter avec Kyros" : "Se connecter avec Kyros";
    sessionRoot.innerHTML = `
        <section class="session-select" aria-labelledby="session-title">
            <div class="session-select__top">
                <time class="session-clock">
                    <span class="session-clock__time">${time}</span>
                    <span class="session-clock__date">${date}</span>
                </time>
            </div>
            <div class="session-select__main">
                <img class="session-logo" src="./images/interface-logo/luma-os-logo.svg" alt="Luma OS" width="112" height="112">
                <h1 id="session-title">Luma OS</h1>
                ${unreachable
                    ? `<p class="session-select__offline">Soit le serveur web n’est pas lancé, soit votre connexion est coupée. Relancez le serveur puis réessayez.</p>`
                    : `<p class="session-select__intro">Retrouvez votre espace LUMA avec votre identité Kyros.</p>`}
                ${unreachable
                    ? `<button id="session-retry" class="luma-primary-button" type="button">Réessayer</button>`
                    : `<button id="session-connect" class="luma-primary-button" type="button" ${available ? "" : "disabled"}>${buttonLabel}</button>`}
                ${message ? `<p class="session-select__status" role="status" aria-live="polite">${escapeHtml(message)}</p>` : ""}
            </div>
            <div class="session-select__bottom">
                ${lastUser ? `
                <div class="session-user">
                    ${avatarMarkupHtml}
                    <span class="session-user__name">${escapeHtml(displayName)}</span>
                </div>` : `<span class="session-user__empty"></span>`}
                <div class="session-select__statusbar" aria-hidden="true">
                    <span class="session-status-icon" title="Réseau Luma"><svg class="icon"><use href="#icon-luma-network"></use></svg></span>
                    <span class="session-status-icon session-status-icon--battery" data-lock-battery title="Alimentation"><svg class="icon"><use href="#icon-battery"></use></svg></span>
                </div>
            </div>
        </section>`;
    hydrateAvatars(sessionRoot);
    updateLockClock();
    window.clearInterval(lockClockInterval);
    lockClockInterval = window.setInterval(updateLockClock, 30_000);
    updateLockBattery();
    document.getElementById(unreachable ? "session-retry" : "session-connect").addEventListener("click", async (event) => {
        event.currentTarget.disabled = true;
        if (unreachable) return bootstrap();
        // Reprise après verrouillage : le bureau est déjà construit, on vérifie
        // la session serveur puis on réaffiche le desktop sans nouveau boot.
        if (authenticated) {
            if (windowManager) return resumeSession(user);
            return loadDesktopSession(user);
        }
        window.location.assign("/auth/login");
    });
}

let lockClockInterval = null;

function updateLockClock() {
    const now = new Date();
    const timeElement = document.querySelector(".session-clock__time");
    const dateElement = document.querySelector(".session-clock__date");
    if (!timeElement || !dateElement) return;
    timeElement.textContent = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(now);
    dateElement.textContent = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "2-digit", month: "long" }).format(now);
}

function updateLockBattery() {
    const element = document.querySelector("[data-lock-battery]");
    if (!element || !("getBattery" in navigator)) return;
    navigator.getBattery().then((battery) => {
        const icon = element.querySelector("use");
        const apply = () => {
            icon?.setAttribute("href", battery.charging ? "#icon-plug" : "#icon-battery");
            element.dataset.charging = String(battery.charging);
            element.dataset.level = `${Math.round(battery.level * 100)} %`;
        };
        apply();
        battery.addEventListener("levelchange", apply);
        battery.addEventListener("chargingchange", apply);
    }).catch(() => {});
}

let remoteSessionTimer = null;

function armIdleTimer() {
    window.clearTimeout(idleTimer);
    idleTimer = null;
    if (locked || desktop.hidden || !Number.isInteger(lockAfterIdleMs) || lockAfterIdleMs <= 0) return;
    idleTimer = window.setTimeout(lockSession, lockAfterIdleMs);
}

function noteActivity() {
    if (locked || desktop.hidden || !idleTimer) return;
    const now = Date.now();
    if (now - lastIdleResetAt < 1000) return;
    lastIdleResetAt = now;
    armIdleTimer();
}

function lockSession({ announce = true } = {}) {
    if (locked) return;
    locked = true;
    window.clearTimeout(idleTimer);
    idleTimer = null;
    setStartPanel(false);
    renderSessionScreen({ authenticated: true, user: currentUser, message: "Session verrouillée." });
    if (announce) sessionChannel?.postMessage({ type: "lock" });
}

async function resumeSession(user) {
    try {
        const session = await requestJson("/api/session");
        if (!session.authenticated) {
            locked = false;
            currentUser = null;
            renderSessionScreen({ authentication: { available: true }, message: "Session terminée. Connectez-vous à nouveau." });
            return;
        }
        currentUser = session.user || user;
        locked = false;
        desktop.hidden = false;
        sessionRoot.hidden = true;
        armIdleTimer();
    } catch (error) {
        const unreachable = error instanceof TypeError;
        renderSessionScreen({
            authenticated: true,
            user,
            unreachable,
            message: unreachable ? "Le serveur Luma est injoignable." : "La session n’a pas pu être confirmée. Réessayez."
        });
    }
}

function endSessionLocally(message) {
    locked = false;
    currentUser = null;
    window.clearTimeout(idleTimer);
    idleTimer = null;
    clearAvatarCache();
    setAvatarOwner(null);
    renderSessionScreen({ authentication: { available: true }, message });
}

function persistSessionRemotely(windows) {
    if (suspendSessionSync) return;
    window.clearTimeout(remoteSessionTimer);
    remoteSessionTimer = window.setTimeout(async () => {
        try { await putJson("/api/users/me/windows", { windows }); } catch { /* synchro best-effort */ }
    }, 600);
}

function flushSession() {
    if (!windowManager || suspendSessionSync) return;
    windowManager.saveSession();
    try {
        fetch("/api/users/me/windows", {
            method: "PUT",
            keepalive: true,
            credentials: "same-origin",
            headers: { accept: "application/json", "content-type": "application/json" },
            body: JSON.stringify({ windows: windowManager.getWindows() })
        }).catch(() => { /* synchro best-effort */ });
    } catch { /* synchro best-effort */ }
}

// Bascule d'espace : flush attendu de la disposition courante puis suspension
// de la synchro (le serveur applique la disposition de la cible ; un éventuel
// debounce en vol ne doit pas l'écraser).
async function suspendSessionForWorkspaceSwitch() {
    if (windowManager) {
        try { await putJson("/api/users/me/windows", { windows: windowManager.getWindows() }); } catch { /* best-effort */ }
    }
    window.clearTimeout(remoteSessionTimer);
    remoteSessionTimer = null;
    suspendSessionSync = true;
}

function resumeSessionSync() {
    suspendSessionSync = false;
}

async function fetchSavedWindows() {
    try {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 1500);
        try {
            const result = await requestJson("/api/users/me/windows", { signal: controller.signal });
            return Array.isArray(result?.windows) ? result.windows : null;
        } finally {
            window.clearTimeout(timer);
        }
    } catch {
        return null;
    }
}

async function loadDesktopSession(user) {
    currentUser = user;
    setAvatarOwner(user?.id || null);
    try { localStorage.setItem("luma.last-user", JSON.stringify({ displayName: user?.displayName || "", username: user?.username || "", avatarUrl: user?.avatarUrl || null })); } catch { /* stockage indisponible */ }
    const startedAt = performance.now();
    desktop.hidden = true;
    sessionRoot.hidden = false;
    sessionRoot.innerHTML = `
        <section class="luma-boot" aria-labelledby="boot-title">
            <span class="luma-boot__logo"><svg class="icon" aria-hidden="true"><use href="#icon-luma"></use></svg></span>
            <div><h1 id="boot-title">Luma OS</h1><p data-boot-status role="status" aria-live="polite">Vérification de la session…</p></div>
            <div class="luma-boot__track" aria-hidden="true"><i data-boot-progress></i></div>
        </section>`;
    const bootStatus = sessionRoot.querySelector("[data-boot-status]");
    const bootProgress = sessionRoot.querySelector("[data-boot-progress]");
    const progress = (value, label) => {
        bootProgress.style.transform = `scaleX(${value / 100})`;
        bootStatus.textContent = label;
    };
    const name = user?.displayName || user?.username || "Utilisateur Luma";
    document.getElementById("account-name").textContent = name;
    document.getElementById("account-avatar").outerHTML = avatarMarkup(user?.avatarUrl, name, { className: "account-avatar", id: "account-avatar" });
    hydrateAvatars(document);
    try {
        progress(36, "Chargement de votre environnement…");
        const [settings, health] = await Promise.all([
            requestJson("/api/users/me/settings"),
            requestJson("/api/health").catch(() => null),
            loadRegistryApps()
        ]);
        applySettings(settings);
        if (health?.version) systemVersion = health.version;
        await migrateLegacyStartupApps();
    } catch (error) {
        // 401 : l'événement luma:session-expired a déjà rendu l'écran de
        // session, inutile de poursuivre le boot sur un desktop invisible.
        if (error?.status === 401) return;
        applySettings({ theme: "luma", accentColor: "#6d5ee8", wallpaper: "./images/backgrounds/background-00.jpg", density: "comfortable", motion: "system" });
        toast("Les préférences n’ont pas pu être chargées.");
    }
    if (!windowManager) {
        progress(72, "Initialisation du bureau…");
        windowManager = createWindowManager({
            layer: document.getElementById("window-layer"),
            taskbar: document.getElementById("taskbar-apps"),
            apps,
            version: systemVersion,
            onToast: toast,
            onSessionChange: persistSessionRemotely
        });
        window.LumaOS = Object.freeze({
            openApp: windowManager.openApp,
            closeWindow: windowManager.close,
            getWindows: windowManager.getWindows,
            setWindowState: windowManager.setAppState,
            setWindowTitle: windowManager.setTitle,
            saveSession: flushSession,
            lock: lockSession,
            suspendSessionSync: suspendSessionForWorkspaceSwitch,
            resumeSessionSync
        });
    }
    if (restoreSessionEnabled) {
        progress(88, "Recherche de votre session…");
        const saved = await fetchSavedWindows();
        if (saved?.length) {
            progress(92, "Réouverture de vos applications récemment ouvertes…");
            windowManager.restoreSession(saved);
        } else if (windowManager.hasSavedSession()) {
            progress(92, "Réouverture de vos applications récemment ouvertes…");
            windowManager.restoreSession();
        }
    }
    progress(100, "Votre espace est prêt.");
    await new Promise((resolve) => window.setTimeout(resolve, Math.max(0, 760 - (performance.now() - startedAt))));
    sessionRoot.querySelector(".luma-boot")?.classList.add("is-leaving");
    await new Promise((resolve) => window.setTimeout(resolve, 180));
    sessionRoot.hidden = true;
    desktop.hidden = false;
    armIdleTimer();
    launchStartupApps();
}

async function bootstrap() {
    renderStartResults();
    try {
        const session = await requestJson("/api/session");
        if (session.authenticated) await loadDesktopSession(session.user);
        else renderSessionScreen(session);
    } catch (error) {
        const unreachable = error instanceof TypeError;
        renderSessionScreen({
            unreachable,
            message: unreachable ? "Le serveur Luma est injoignable." : "Le service de session est indisponible. Rechargez la page pour réessayer."
        });
    }
}

launcher.addEventListener("click", () => setStartPanel(startPanel.hidden));
document.getElementById("app-search").addEventListener("input", (event) => {
    const value = event.target.value;
    renderStartResults(value);
    window.clearTimeout(documentSearchTimer);
    documentSearchTimer = window.setTimeout(async () => {
        await loadDocumentResults(value);
        if (String(document.getElementById("app-search").value).trim() === value.trim()) renderStartResults(value);
    }, 250);
});
document.addEventListener("click", (event) => {
    const appButton = event.target.closest("[data-open-app]");
    if (appButton && windowManager) {
        const data = {};
        if (appButton.dataset.openSearch) data.search = appButton.dataset.openSearch;
        if (appButton.dataset.openView) data.view = appButton.dataset.openView;
        // Les fenêtres déjà ouvertes ignorent les options d'ouverture : les deux
        // événements portent la demande quand l'application est déjà montée.
        if (appButton.dataset.openSearch) {
            window.dispatchEvent(new CustomEvent("luma:documents-search", { detail: { query: appButton.dataset.openSearch } }));
        }
        if (appButton.dataset.openView) {
            window.dispatchEvent(new CustomEvent("luma:settings-view", { detail: { view: appButton.dataset.openView } }));
        }
        windowManager.openApp(appButton.dataset.openApp, Object.keys(data).length ? { data } : undefined);
        setStartPanel(false);
    }
    if (!startPanel.hidden && !startPanel.contains(event.target) && !launcher.contains(event.target)) setStartPanel(false);
});

document.addEventListener("contextmenu", (event) => {
    if (desktop.hidden || event.target.closest(".luma-window") || event.target.closest(".taskbar") || event.target.closest(".start-panel") || event.target.closest(".context-menu")) return;
    const shortcut = event.target.closest(".desktop-shortcut");
    event.preventDefault();
    showContextMenu(event.clientX, event.clientY, [
        { label: "Personnaliser le fond d'écran", action: () => windowManager.openApp("settings") },
        "separator",
        { label: shortcut ? `Ouvrir ${shortcut.textContent.trim()}` : "Créer un dossier", action: () => {
            if (shortcut) { windowManager.openApp(shortcut.dataset.openApp); return; }
            createDesktopFolder();
        } }
    ]);
});

async function createDesktopFolder() {
    try {
        await postJson("/api/documents/folders", { name: "Nouveau dossier", parentId: null });
        toast("Dossier créé dans Documents.");
        windowManager.openApp("documents");
    } catch (error) {
        toast(error.message);
    }
}

document.getElementById("clock").addEventListener("click", () => {
    if (!desktop.hidden && windowManager) windowManager.openApp("calendar");
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !startPanel.hidden) setStartPanel(false);
    if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k" && !desktop.hidden) {
        event.preventDefault();
        setStartPanel(true);
    }
    if (!startPanel.hidden && (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "Enter")) {
        const buttons = [...startApps.querySelectorAll(".start-app")];
        if (buttons.length) {
            event.preventDefault();
            if (event.key === "Enter") {
                (buttons[searchActiveIndex] || buttons[0]).click();
            } else {
                const delta = event.key === "ArrowDown" ? 1 : -1;
                searchActiveIndex = searchActiveIndex < 0
                    ? (delta > 0 ? 0 : buttons.length - 1)
                    : Math.min(buttons.length - 1, Math.max(0, searchActiveIndex + delta));
                buttons.forEach((button, index) => button.classList.toggle("is-active", index === searchActiveIndex));
                buttons[searchActiveIndex]?.scrollIntoView({ block: "nearest" });
            }
        }
    }
    if (desktop.hidden) return;
    const shortcutReload = event.key === "F5" || ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "r");
    if (shortcutReload) {
        event.preventDefault();
        windowManager?.saveSession();
        toast("La réactualisation est désactivée. Vos fenêtres restent ouvertes.");
    }
});

window.addEventListener("beforeunload", () => {
    if (windowManager) windowManager.saveSession();
});

document.addEventListener("click", async (event) => {
    const action = event.target.closest("[data-session-action]")?.dataset.sessionAction;
    if (!action) return;
    setStartPanel(false);
    if (action === "logout") {
        try { await postJson("/api/auth/logout"); } catch { toast("La révocation Kyros n’a pas pu être confirmée."); }
        endSessionLocally("Vous êtes déconnecté.");
        sessionChannel?.postMessage({ type: "logout" });
    } else if (action === "lock") {
        lockSession();
    }
});

// Verrou/déconnexion reçus d'un autre onglet du même navigateur.
sessionChannel?.addEventListener("message", (event) => {
    if (event.data?.type === "lock") lockSession({ announce: false });
    if (event.data?.type === "logout") endSessionLocally("Session close sur un autre onglet.");
});

// Session expirée ou close depuis un autre appareil (401 servi par luma-api.js).
window.addEventListener("luma:session-expired", () => {
    if (locked) return;
    if (sessionRoot.querySelector(".session-select")) return;
    endSessionLocally("Session expirée ou close depuis un autre appareil.");
});

// Réarmement du verrouillage automatique sur l'activité de l'utilisateur.
document.addEventListener("pointerdown", noteActivity, true);
document.addEventListener("keydown", noteActivity, true);
document.addEventListener("touchstart", noteActivity, true);
document.addEventListener("wheel", noteActivity, { capture: true, passive: true });

function updateClock() {
    const now = new Date();
    const clock = document.getElementById("clock");
    clock.querySelector("span").textContent = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(now);
    clock.querySelector("small").textContent = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(now);
}

updateClock();
window.setInterval(updateClock, 30_000);
window.addEventListener("luma:settings", (event) => applySettings(event.detail));
window.addEventListener("luma:apps-changed", () => renderStartResults(document.getElementById("app-search").value));

const batteryButton = document.getElementById("taskbar-battery");
const batteryIcon = batteryButton?.querySelector("use");
const batteryPercent = batteryButton?.querySelector("[data-battery-percent]");

function setBatteryIndicator(level, charging) {
    if (!batteryButton) return;
    const percent = Math.round(level * 100);
    batteryPercent.textContent = `${percent} %`;
    batteryButton.setAttribute("aria-label", charging ? `Alimentation : secteur (${percent} %)` : `Alimentation : batterie (${percent} %)`);
    batteryButton.classList.toggle("is-charging", charging);
    batteryButton.classList.toggle("is-low", !charging && percent <= 20);
    batteryIcon?.setAttribute("href", charging ? "#icon-plug" : "#icon-battery");
}

async function startBatteryIndicator() {
    if (!batteryButton || !("getBattery" in navigator)) return;
    try {
        const battery = await navigator.getBattery();
        const update = () => setBatteryIndicator(battery.level, battery.charging);
        update();
        batteryButton.hidden = false;
        battery.addEventListener("levelchange", update);
        battery.addEventListener("chargingchange", update);
    } catch { /* Battery API indisponible : indicateur masqué */ }
}

batteryButton?.addEventListener("click", () => windowManager?.openApp("power"));

startBatteryIndicator();

const updateButton = document.getElementById("taskbar-update");
const UPDATE_BUTTON_LABELS = {
    idle: "Mise à jour de Luma OS",
    checking: "Recherche de mises à jour en cours",
    available: "Mise à jour de Luma OS disponible",
    updating: "Installation de la mise à jour en cours",
    error: "La mise à jour de Luma OS a échoué",
    "up-to-date": "Luma OS est à jour",
    unsupported: "Mise à jour non prise en charge par ce navigateur"
};
const UPDATE_BUTTON_STATES = new Set(["checking", "available", "updating", "error"]);

function applyUpdateButtonState(detail) {
    if (!updateButton) return;
    updateButton.dataset.updateState = detail.phase;
    updateButton.setAttribute("aria-label", UPDATE_BUTTON_LABELS[detail.phase] || UPDATE_BUTTON_LABELS.idle);
    updateButton.hidden = !UPDATE_BUTTON_STATES.has(detail.phase);
}

window.LumaSwUpdate?.attachIndicator?.(applyUpdateButtonState);

updateButton?.addEventListener("click", () => {
    windowManager?.openApp("settings", { instanceKey: "settings", data: { view: "update" } });
    window.dispatchEvent(new CustomEvent("luma:settings-view", { detail: { view: "update" } }));
});

bootstrap();
