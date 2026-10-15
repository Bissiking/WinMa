const CHECK_INTERVAL_MS = 30 * 60 * 1000;
const BUILD_EVENT_URL = "./api/system/build-events";
const RETRY_BASE_MS = 30 * 1000;
const RETRY_MAX_MS = 10 * 60 * 1000;
const RELOAD_GUARD_MS = 2000;
const RELOAD_DELAY_MS = 150;
const MAX_INSTALL_ATTEMPTS = 3;
const RELOAD_GUARD_KEY = "luma.sw-last-reload";
const STYLE_ID = "luma-sw-update-style";

const UPDATE_TOAST_TEXT = "Mise à jour disponible : une nouvelle version de Luma OS est prête à être installée.";
const FAILURE_TOAST_TEXT = "La mise à jour n’a pas pu être installée. Vérifiez votre connexion puis réessayez.";

const UPDATE_STYLES = `
.toast__message { margin: 0; font-size: 13px; line-height: 1.5; }
.toast__actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; pointer-events: auto; }
.toast__button {
    min-height: 32px;
    padding: 0 14px;
    border: 1px solid var(--line);
    border-radius: 9px;
    color: var(--ink);
    font: inherit;
    font-size: 12px;
    font-weight: 600;
    background: var(--surface-muted);
    cursor: pointer;
}
.toast__button:hover { border-color: color-mix(in srgb, var(--luma-accent, #6d5ee8) 45%, transparent); }
.toast__button:disabled { cursor: progress; opacity: .6; }
.toast__button--primary { border-color: transparent; color: #fff; background: var(--luma-accent, #6d5ee8); }
.toast__button--primary:hover { background: color-mix(in srgb, var(--luma-accent, #6d5ee8), white 12%); }
.toast--update { border-inline-start: 3px solid var(--luma-accent, #6d5ee8); }
.toast--error { border-inline-start: 3px solid #d64545; }
`;

const state = {
    registration: null,
    confirmed: false,
    reloading: false,
    checkFailures: 0,
    installAttempts: 0,
    retryTimer: null,
    updateToast: null,
    failureToast: null,
    phase: "idle",
    currentVersion: null,
    targetVersion: null,
    lastCheckedAt: null,
    assets: null,
    indicatorAttached: false
};

const listeners = new Set();

function snapshot() {
    return Object.freeze({
        supported: "serviceWorker" in navigator,
        hasRegistration: Boolean(state.registration),
        phase: state.phase,
        currentVersion: state.currentVersion,
        targetVersion: state.targetVersion,
        waiting: Boolean(state.registration?.waiting),
        confirmed: state.confirmed,
        reloading: state.reloading,
        installAttempts: state.installAttempts,
        checkFailures: state.checkFailures,
        lastCheckedAt: state.lastCheckedAt,
        assets: state.assets ? [...state.assets] : null,
        indicatorAttached: state.indicatorAttached
    });
}

function derivePhase() {
    if (!("serviceWorker" in navigator)) return "unsupported";
    if (state.reloading || (state.confirmed && state.registration?.waiting)) return "updating";
    if (state.installAttempts > 0) return "error";
    if (state.registration?.waiting || state.registration?.installing) return "available";
    if (state.currentVersion && state.targetVersion) {
        return state.currentVersion === state.targetVersion ? "up-to-date" : "available";
    }
    return state.registration ? "checking" : "idle";
}

function notify() {
    state.phase = derivePhase();
    const detail = snapshot();
    for (const listener of listeners) {
        try { listener(detail); } catch { /* auditeur en erreur : ignoré */ }
    }
}

function subscribe(listener) {
    if (typeof listener !== "function") return () => {};
    listeners.add(listener);
    try { listener(snapshot()); } catch { /* auditeur en erreur : ignoré */ }
    return () => listeners.delete(listener);
}

// Tant que la barre des tâches n'est pas aux commandes (ancien shell en cache),
// la notification reste le seul moyen d'informer l'utilisateur. Dès qu'elle est
// branchée, plus aucune popup : l'état vit dans la barre des tâches et Paramètres.
function attachIndicator(listener) {
    state.indicatorAttached = true;
    return subscribe(listener);
}

function withServiceWorkerMessage(type, payloadType, timeout = 3000) {
    return new Promise((resolve) => {
        const controller = navigator.serviceWorker?.controller;
        if (!controller) { resolve(null); return; }
        const onMessage = (event) => {
            if (event.data?.type !== payloadType) return;
            window.clearTimeout(timer);
            navigator.serviceWorker.removeEventListener("message", onMessage);
            resolve(event.data);
        };
        const timer = window.setTimeout(() => {
            navigator.serviceWorker.removeEventListener("message", onMessage);
            resolve(null);
        }, timeout);
        navigator.serviceWorker.addEventListener("message", onMessage);
        controller.postMessage({ type });
    });
}

async function readTargetVersion() {
    try {
        const response = await fetch("./sw.js", { method: "GET", cache: "no-store" });
        if (!response.ok) return null;
        const match = (await response.text()).match(/RAW_BUILD_VERSION\s*=\s*"([0-9a-f]{16})"/);
        return match ? match[1] : null;
    } catch { return null; }
}

function pingController() {
    return withServiceWorkerMessage("PING", "PONG").then((data) => data?.version || null);
}

async function requestAssets() {
    if (state.assets?.length) return [...state.assets];
    const data = await withServiceWorkerMessage("GET_ASSETS", "ASSETS");
    if (Array.isArray(data?.assets) && data.assets.length) {
        state.assets = data.assets;
        notify();
        return [...state.assets];
    }
    return null;
}

async function refreshVersions() {
    state.targetVersion = await readTargetVersion();
    state.currentVersion = await pingController();
    notify();
    return snapshot();
}

function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = UPDATE_STYLES;
    (document.head || document.documentElement).append(style);
}

function isAttached(element) {
    return Boolean(element) && element.isConnected;
}

function createToast(message, { actions = [], duration = 0, modifier = "" } = {}) {
    const region = document.getElementById("toast-region");
    if (!region) return null;

    const element = document.createElement("div");
    element.className = `toast${modifier ? ` ${modifier}` : ""}`;
    element.dataset.lumaToast = "service-worker";

    const text = document.createElement("p");
    text.className = "toast__message";
    text.textContent = message;
    element.append(text);

    if (actions.length) {
        const bar = document.createElement("div");
        bar.className = "toast__actions";
        for (const action of actions) {
            const button = document.createElement("button");
            button.type = "button";
            button.className = `toast__button${action.primary ? " toast__button--primary" : ""}`;
            button.textContent = action.label;
            button.addEventListener("click", (event) => {
                event.stopPropagation();
                action.onSelect?.(event, element);
            });
            bar.append(button);
        }
        element.append(bar);
    }

    region.append(element);
    if (duration > 0) window.setTimeout(() => element.remove(), duration);
    return element;
}

function promptUpdate() {
    if (state.indicatorAttached) {
        notify();
        return null;
    }
    if (isAttached(state.updateToast)) return state.updateToast;
    state.updateToast = createToast(UPDATE_TOAST_TEXT, {
        modifier: "toast--update",
        actions: [
            { label: "Mettre à jour", primary: true, onSelect: applyUpdate },
            { label: "Plus tard", onSelect: (_event, element) => { element.remove(); notify(); } }
        ]
    });
    notify();
    return state.updateToast;
}

function promptFailure() {
    if (isAttached(state.failureToast)) return state.failureToast;
    state.failureToast = createToast(FAILURE_TOAST_TEXT, {
        modifier: "toast--error",
        duration: 12000,
        actions: [
            {
                label: "Réessayer",
                primary: true,
                onSelect: (_event, element) => {
                    element.remove();
                    state.failureToast = null;
                    state.installAttempts = 0;
                    state.checkFailures = 0;
                    notify();
                    checkForUpdate();
                }
            }
        ]
    });
    notify();
    return state.failureToast;
}

function clearFailurePrompt() {
    if (!isAttached(state.failureToast)) {
        state.failureToast = null;
        return;
    }
    state.failureToast.remove();
    state.failureToast = null;
}

function applyUpdate(_event, element) {
    state.confirmed = true;
    notify();
    const registration = state.registration;
    if (registration?.waiting) {
        registration.waiting.postMessage({ type: "SKIP_WAITING" });
        return;
    }
    if (registration?.installing) return;
    if (!navigator.serviceWorker.controller) return;
    element?.remove();
    reloadOnce();
}

function readReloadGuard() {
    try {
        return Number(sessionStorage.getItem(RELOAD_GUARD_KEY) || 0);
    } catch {
        return 0;
    }
}

function writeReloadGuard(value) {
    try {
        sessionStorage.setItem(RELOAD_GUARD_KEY, String(value));
    } catch { /* stockage indisponible */ }
}

function saveSessionBeforeReload() {
    try {
        window.LumaOS?.saveSession?.();
    } catch { /* sauvegarde best-effort */ }
}

function reloadOnce() {
    if (state.reloading) return;
    const now = Date.now();
    if (now - readReloadGuard() < RELOAD_GUARD_MS) return;
    state.reloading = true;
    writeReloadGuard(now);
    saveSessionBeforeReload();
    notify();
    window.setTimeout(() => window.location.reload(), RELOAD_DELAY_MS);
}

function onControllerChange() {
    if (!state.confirmed) {
        refreshVersions();
        return;
    }
    reloadOnce();
}

function scheduleRetry(delay = RETRY_BASE_MS) {
    if (state.retryTimer) return;
    state.retryTimer = window.setTimeout(() => {
        state.retryTimer = null;
        checkForUpdate();
    }, Math.min(delay, RETRY_MAX_MS));
}

function observeWorker(registration, worker) {
    if (!worker) return;
    worker.addEventListener("statechange", () => {
        if (worker.state === "installed") {
            state.installAttempts = 0;
            clearFailurePrompt();
            if (navigator.serviceWorker.controller) promptUpdate();
            if (state.confirmed && registration.waiting) {
                registration.waiting.postMessage({ type: "SKIP_WAITING" });
            }
            notify();
            return;
        }
        if (worker.state === "redundant" && !state.confirmed) {
            state.installAttempts += 1;
            promptFailure();
            if (state.installAttempts <= MAX_INSTALL_ATTEMPTS) {
                scheduleRetry(RETRY_BASE_MS * 2 ** (state.installAttempts - 1));
            }
            notify();
        }
    });
}

function watchRegistration(registration) {
    registration.addEventListener("updatefound", () => observeWorker(registration, registration.installing));
    observeWorker(registration, registration.installing);
}

// Le serveur diffuse l'empreinte de build en direct : un déploiement (git pull,
// redémarrage) change l'empreinte et chaque onglet ouvert vérifie de lui-même,
// sans rechargement de page ni intervention de l'utilisateur.
function watchBuildStream() {
    if (typeof EventSource === "undefined") return null;
    const source = new EventSource(BUILD_EVENT_URL);
    source.addEventListener("build", (event) => {
        let build = null;
        try { build = JSON.parse(event.data)?.build || null; } catch { return; }
        if (!build || !state.targetVersion || build === state.targetVersion) return;
        checkForUpdate();
    });
    // EventSource se reconnecte seul après un redémarrage du serveur.
    source.addEventListener("error", () => { /* reconnexion automatique */ });
    return source;
}

async function checkForUpdate() {
    if (!state.registration) {
        notify();
        return false;
    }

    if ("onLine" in navigator && !navigator.onLine) {
        state.checkFailures += 1;
    } else {
        try {
            await state.registration.update();
            state.checkFailures = 0;
            state.lastCheckedAt = new Date().toISOString();
            await refreshVersions();
            return true;
        } catch {
            state.checkFailures += 1;
            state.lastCheckedAt = new Date().toISOString();
        }
    }

    scheduleRetry(RETRY_BASE_MS * 2 ** Math.min(state.checkFailures - 1, 5));
    notify();
    return false;
}

async function registerServiceWorker() {
    const probe = await fetch("./sw.js", { method: "HEAD", cache: "no-store" });
    if (!probe.ok) { notify(); return; }

    const registration = await navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" });
    state.registration = registration;
    watchRegistration(registration);

    if (registration.waiting && navigator.serviceWorker.controller) promptUpdate();
    notify();

    window.setInterval(() => checkForUpdate(), CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) checkForUpdate();
    });
    window.addEventListener("online", () => checkForUpdate());
    watchBuildStream();

    await checkForUpdate();
}

function exposeDebugApi() {
    window.LumaSwUpdate = Object.freeze({
        check: checkForUpdate,
        apply: () => applyUpdate(),
        refresh: refreshVersions,
        subscribe,
        attachIndicator,
        requestAssets,
        getState: () => snapshot()
    });
}

async function init() {
    ensureStyles();
    exposeDebugApi();
    if (!("serviceWorker" in navigator)) {
        notify();
        return;
    }

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    try {
        await registerServiceWorker();
    } catch { /* service worker indisponible : la vérification reprend au prochain accès */ }
}

init();
