import { requestJson, postJson, putJson } from "./luma-api.js";
import { createWindowManager } from "./luma-window-manager.js";
import { showContextMenu } from "./luma-context-menu.js";
import { welcomeMessage } from "./luma-welcome.js";

const apps = [
    { id: "documents", name: "Documents", taskbarName: "Docs", icon: "documents", module: "/apps/documents/app.js", width: 980, height: 700, minWidth: 640, minHeight: 420, position: { left: .28, top: .14 } },
    { id: "calculator", name: "Calculatrice", taskbarName: "Calc.", icon: "calculator", module: "/apps/calculator/app.js", width: 420, height: 620, minWidth: 340, minHeight: 480, position: { left: .34, top: .1 } },
    { id: "terminal", name: "Terminal", taskbarName: "Term.", icon: "terminal", module: "/apps/terminal/app.js", width: 760, height: 520, minWidth: 480, minHeight: 320, position: { left: .15, top: .2 } },
    { id: "calendar", name: "Calendrier", taskbarName: "Agenda", icon: "calendar", module: "/apps/calendar/app.js", width: 940, height: 660, minWidth: 600, minHeight: 460, position: { left: .22, top: .12 } },
    { id: "settings", name: "Paramètres", taskbarName: "Config", icon: "settings", module: "/apps/parametres/app.js", width: 1040, height: 720, minWidth: 680, minHeight: 440, position: { left: .07, top: .07 } },
    { id: "task-manager", name: "Gestionnaire des tâches", taskbarName: "Tâches", icon: "activity", module: "/apps/task-manager/app.js", width: 920, height: 650, minWidth: 660, minHeight: 440, position: { left: .12, top: .08 } },
    { id: "luma-orbit", name: "Luma Orbit", taskbarName: "Orbit", icon: "orbit", module: "/apps/luma-orbit/app.js", width: 1040, height: 720, minWidth: 680, minHeight: 480, position: { left: .09, top: .06 } },
    { id: "sonora-studio", name: "Sonora Studio", taskbarName: "Sonora", icon: "music", logo: "/images/interface-logo/applications/sonora-studio.svg", module: "/apps/sonora-studio/app.js", width: 1120, height: 740, minWidth: 700, minHeight: 480, storeManaged: true, position: { left: .06, top: .04 } },
    { id: "braindump", name: "BrainDump", taskbarName: "Brain", icon: "notepad", module: "/apps/braindump/app.js", width: 1040, height: 700, minWidth: 620, minHeight: 440, storeManaged: true, position: { left: .1, top: .06 } },
    { id: "matheo-systems", name: "Matheo Systems", taskbarName: "Matheo", icon: "chip", module: "/apps/matheo-systems/app.js", width: 1060, height: 730, minWidth: 700, minHeight: 500, position: { left: .08, top: .05 }, hidden: true },
    { id: "notepad", name: "Bloc-notes", taskbarName: "Notes", icon: "notepad", module: "/apps/notepad/app.js", width: 800, height: 640, minWidth: 520, minHeight: 400, position: { left: .18, top: .1 } },
    { id: "image-viewer", name: "Photos Luma", taskbarName: "Photos", icon: "image", module: "/apps/image-viewer/app.js", width: 900, height: 680, minWidth: 480, minHeight: 360, hidden: true, position: { left: .16, top: .08 } },
    { id: "music-player", name: "Lecteur de musique", taskbarName: "Musique", icon: "music", module: "/apps/music-player/app.js", width: 640, height: 720, minWidth: 420, minHeight: 480, hidden: true, position: { left: .2, top: .06 } },
    { id: "video-player", name: "Lecteur vidéo", taskbarName: "Vidéo", icon: "video", module: "/apps/video-player/app.js", width: 980, height: 700, minWidth: 560, minHeight: 400, hidden: true, position: { left: .12, top: .08 } },
    { id: "power", name: "Alimentation", taskbarName: "Alim.", icon: "power", module: "/apps/power/app.js", width: 480, height: 560, minWidth: 380, minHeight: 420, position: { left: .3, top: .12 } },
    { id: "timer", name: "Minuteur", taskbarName: "Min.", icon: "timer", module: "/apps/timer/app.js", width: 520, height: 620, minWidth: 380, minHeight: 440, position: { left: .32, top: .1 } },
    { id: "trash", name: "Corbeille", taskbarName: "Corb.", icon: "trash", module: "/apps/documents/app.js", width: 980, height: 660, minWidth: 620, minHeight: 400 }
];

const desktop = document.getElementById("luma-desktop");
const sessionRoot = document.getElementById("session-root");
const startPanel = document.getElementById("start-panel");
const launcher = document.getElementById("luma-launcher");
const startApps = document.getElementById("start-apps");
const toastRegion = document.getElementById("toast-region");
let windowManager;
let currentUser;
let startupLaunched = false;
let restoreSessionEnabled = true;
let systemVersion = "3.1.0";

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
    restoreSessionEnabled = settings.restoreSession !== false;
    const theme = resolveTheme(settings.theme || "luma");
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.density = settings.density || "comfortable";
    document.documentElement.dataset.motion = settings.motion === "system"
        ? (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduced" : "full")
        : (settings.motion || "full");
    document.documentElement.style.setProperty("--luma-accent", settings.accentColor || "#6d5ee8");
    document.documentElement.style.setProperty("--luma-accent-rgb", hexToRgb(settings.accentColor || "#6d5ee8"));
    if (settings.wallpaper) document.body.style.backgroundImage = `url("${settings.wallpaper}")`;
}

function setStartPanel(open) {
    startPanel.hidden = !open;
    launcher.setAttribute("aria-expanded", String(open));
    launcher.setAttribute("aria-pressed", String(open));
    if (open) window.setTimeout(() => document.getElementById("app-search").focus(), 0);
}

function renderStartApps(filter = "") {
    const normalized = filter.trim().toLocaleLowerCase("fr");
    let installed = new Set();
    try { installed = new Set(JSON.parse(localStorage.getItem("luma.orbit.installed") || "[]")); } catch { installed = new Set(); }
    const visible = apps.filter((app) => !app.hidden && (!app.storeManaged || installed.has(app.id)) && app.name.toLocaleLowerCase("fr").includes(normalized));
    startApps.innerHTML = visible.length ? visible.map((app) => `
        <button class="start-app" type="button" data-open-app="${app.id}">
            ${iconFor(app)}<span>${app.name}</span>
        </button>`).join("") : '<p class="start-empty">Aucune application trouvée.</p>';
}

function launchStartupApps() {
    if (startupLaunched || !windowManager) return;
    startupLaunched = true;
    let startupIds = [];
    try { startupIds = JSON.parse(localStorage.getItem("luma.startup-apps") || "[]"); } catch { startupIds = []; }
    startupIds.filter((id) => apps.some((app) => app.id === id && !app.hidden)).forEach((id, index) => {
        window.setTimeout(() => windowManager.openApp(id), index * 90);
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
    const avatar = displayName.trim().charAt(0).toLocaleUpperCase("fr") || "L";
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
                    <span class="session-user__avatar" aria-hidden="true">${escapeHtml(avatar)}</span>
                    <span class="session-user__name">${escapeHtml(displayName)}</span>
                </div>` : `<span class="session-user__empty"></span>`}
                <div class="session-select__statusbar" aria-hidden="true">
                    <span class="session-status-icon" title="Réseau Luma"><svg class="icon"><use href="#icon-luma-network"></use></svg></span>
                    <span class="session-status-icon session-status-icon--battery" data-lock-battery title="Alimentation"><svg class="icon"><use href="#icon-battery"></use></svg></span>
                </div>
            </div>
        </section>`;
    updateLockClock();
    window.clearInterval(lockClockInterval);
    lockClockInterval = window.setInterval(updateLockClock, 30_000);
    updateLockBattery();
    document.getElementById(unreachable ? "session-retry" : "session-connect").addEventListener("click", async (event) => {
        event.currentTarget.disabled = true;
        if (unreachable) return bootstrap();
        if (authenticated) return loadDesktopSession(user);
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

function persistSessionRemotely(windows) {
    window.clearTimeout(remoteSessionTimer);
    remoteSessionTimer = window.setTimeout(async () => {
        try { await putJson("/api/users/me/windows", { windows }); } catch { /* synchro best-effort */ }
    }, 600);
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
    try { localStorage.setItem("luma.last-user", JSON.stringify({ displayName: user?.displayName || "", username: user?.username || "" })); } catch { /* stockage indisponible */ }
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
    document.getElementById("account-avatar").textContent = name.trim().charAt(0).toLocaleUpperCase("fr") || "L";
    try {
        progress(36, "Chargement de votre environnement…");
        const [settings, health] = await Promise.all([
            requestJson("/api/users/me/settings"),
            requestJson("/api/health").catch(() => null)
        ]);
        applySettings(settings);
        if (health?.version) systemVersion = health.version;
    } catch {
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
            setWindowTitle: windowManager.setTitle
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
    launchStartupApps();
}

async function bootstrap() {
    renderStartApps();
    registerServiceWorker();
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

async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    try {
        const probe = await fetch("./sw.js", { method: "HEAD" });
        if (!probe.ok) return;
        await navigator.serviceWorker.register("./sw.js");
    } catch { /* service worker indisponible : ignoré */ }
}

launcher.addEventListener("click", () => setStartPanel(startPanel.hidden));
document.getElementById("app-search").addEventListener("input", (event) => renderStartApps(event.target.value));
document.addEventListener("click", (event) => {
    const appButton = event.target.closest("[data-open-app]");
    if (appButton && windowManager) {
        windowManager.openApp(appButton.dataset.openApp);
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
        currentUser = null;
        renderSessionScreen({ authentication: { available: true }, message: "Vous êtes déconnecté." });
    } else {
        renderSessionScreen({ authenticated: true, user: currentUser, message: "Session verrouillée." });
    }
});

function updateClock() {
    const now = new Date();
    const clock = document.getElementById("clock");
    clock.querySelector("span").textContent = new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(now);
    clock.querySelector("small").textContent = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(now);
}

updateClock();
window.setInterval(updateClock, 30_000);
window.addEventListener("luma:settings", (event) => applySettings(event.detail));
window.addEventListener("luma:apps-changed", () => renderStartApps(document.getElementById("app-search").value));

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

bootstrap();
