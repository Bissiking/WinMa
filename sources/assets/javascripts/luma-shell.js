import { requestJson, postJson } from "./luma-api.js";
import { createWindowManager } from "./luma-window-manager.js";

const apps = [
    { id: "documents", name: "Documents", icon: "documents", module: "/apps/documents/app.js", width: 980, height: 700, minWidth: 640, minHeight: 420, position: { left: .28, top: .14 } },
    { id: "settings", name: "Paramètres", icon: "settings", module: "/apps/parametres/app.js", width: 1040, height: 720, minWidth: 680, minHeight: 440, position: { left: .07, top: .07 } },
    { id: "trash", name: "Corbeille", icon: "trash", module: "/apps/documents/app.js", width: 980, height: 660, minWidth: 620, minHeight: 400 },
    { id: "browser", name: "Navigateur LUMA", icon: "browser", module: "/apps/web-frame/app.js", url: "https://mhemery.fr", width: 1080, height: 720 },
    { id: "jellyfin", name: "Jellyfin", icon: "jellyfin", module: "/apps/web-frame/app.js", url: "https://jelly.mhemery.fr", width: 1100, height: 740 }
];

const desktop = document.getElementById("luma-desktop");
const sessionRoot = document.getElementById("session-root");
const startPanel = document.getElementById("start-panel");
const launcher = document.getElementById("luma-launcher");
const startApps = document.getElementById("start-apps");
const toastRegion = document.getElementById("toast-region");
let windowManager;
let currentUser;

function iconFor(app) {
    const symbol = app.icon === "settings" ? "settings" : app.icon === "trash" ? "trash" : "folder";
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

function resolveTheme(theme) {
    if (theme !== "system") return theme;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applySettings(settings) {
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
    const visible = apps.filter((app) => app.name.toLocaleLowerCase("fr").includes(normalized));
    startApps.innerHTML = visible.length ? visible.map((app) => `
        <button class="start-app" type="button" data-open-app="${app.id}">
            ${iconFor(app)}<span>${app.name}</span>
        </button>`).join("") : '<p class="start-empty">Aucune application trouvée.</p>';
}

function renderSessionScreen({ authenticated = false, authentication = {}, user = null, message = "" } = {}) {
    desktop.hidden = true;
    sessionRoot.hidden = false;
    const available = authenticated || authentication.available;
    sessionRoot.innerHTML = `
        <section class="session-select" aria-labelledby="session-title">
            <span class="session-logo"><svg class="icon" aria-hidden="true"><use href="#icon-luma"></use></svg></span>
            <h1 id="session-title">Luma OS</h1>
            <p class="session-select__intro">Retrouvez votre espace LUMA avec votre identité Kyros.</p>
            <p class="session-select__status" role="status" aria-live="polite">${message || (available ? "Votre espace est prêt." : "Luma OS doit encore être déclaré dans Kyros.")}</p>
            <button id="session-connect" class="luma-primary-button" type="button" ${available ? "" : "disabled"}>${authenticated ? "Reprendre la session" : "Se connecter avec Kyros"}</button>
        </section>`;
    document.getElementById("session-connect").addEventListener("click", async (event) => {
        event.currentTarget.disabled = true;
        if (authenticated) return loadDesktopSession(user);
        window.location.assign("/auth/login");
    });
}

async function loadDesktopSession(user) {
    currentUser = user;
    sessionRoot.hidden = true;
    desktop.hidden = false;
    const name = user?.displayName || user?.username || "Utilisateur Luma";
    document.getElementById("account-name").textContent = name;
    document.getElementById("account-avatar").textContent = name.trim().charAt(0).toLocaleUpperCase("fr") || "L";
    try {
        applySettings(await requestJson("/api/users/me/settings"));
    } catch {
        applySettings({ theme: "luma", accentColor: "#6d5ee8", wallpaper: "./images/backgrounds/luma-aurora.webp", density: "comfortable", motion: "system" });
        toast("Les préférences n’ont pas pu être chargées.");
    }
    if (!windowManager) {
        windowManager = createWindowManager({
            layer: document.getElementById("window-layer"),
            taskbar: document.getElementById("taskbar-apps"),
            apps,
            onToast: toast
        });
        window.LumaOS = Object.freeze({
            openApp: windowManager.openApp,
            setWindowState: windowManager.setAppState
        });
    }
}

async function bootstrap() {
    renderStartApps();
    try {
        const session = await requestJson("/api/session");
        if (session.authenticated) await loadDesktopSession(session.user);
        else renderSessionScreen(session);
    } catch {
        renderSessionScreen({ message: "Le service de session est indisponible. Rechargez la page pour réessayer." });
    }
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

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !startPanel.hidden) setStartPanel(false);
    if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k" && !desktop.hidden) {
        event.preventDefault();
        setStartPanel(true);
    }
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
bootstrap();
