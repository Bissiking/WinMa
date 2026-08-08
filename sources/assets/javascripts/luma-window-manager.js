const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;

import { showContextMenu } from "./luma-context-menu.js";

const TASKBAR_PIN_KEY = "luma.taskbar.pinned";
const DEFAULT_PINNED = ["documents", "calendar", "task-manager", "terminal"];
const SESSION_KEY = "luma.session.windows";

export function createWindowManager({ layer, taskbar, apps, version = "3.1.0", onToast, onSessionChange = () => {} }) {
    const windows = new Map();
    let topZ = 10;
    let cascade = 0;

    let pinned = loadPinned();
    const pinnedButtons = new Map();

    function loadPinned() {
        try {
            const stored = JSON.parse(localStorage.getItem(TASKBAR_PIN_KEY));
            if (Array.isArray(stored)) return stored.filter((id) => apps.some((item) => item.id === id));
        } catch { /* valeurs invalides ignorées */ }
        return [...DEFAULT_PINNED];
    }

    function savePinned() {
        localStorage.setItem(TASKBAR_PIN_KEY, JSON.stringify(pinned));
    }

    function isPinned(appId) {
        return pinned.includes(appId);
    }

    function syncTaskbarLayout() {
        taskbar.dataset.count = String(pinned.length + windows.size);
        taskbar.dataset.layout = "icons";
        taskbar.closest(".taskbar")?.setAttribute("data-app-layout", "icons");
    }

    function appIcon(app) {
        if (app.logo) return `<span class="app-icon app-icon--image-logo"><img src="${app.logo}" alt=""></span>`;
        const symbols = { settings: "settings", trash: "trash", notepad: "notepad", image: "image", activity: "activity", orbit: "orbit", chip: "chip", calculator: "calc", terminal: "terminal", calendar: "calendar", music: "music", video: "video" };
        return `<span class="app-icon app-icon--${app.icon}">${icon(symbols[app.icon] || "folder")}</span>`;
    }

    function taskbarLabel(app, title = app.name) {
        if (app.taskbarName) return app.taskbarName;
        const characters = Array.from(String(title || "App").trim());
        return characters.length <= 6 ? characters.join("") : `${characters.slice(0, 5).join("")}…`;
    }

    function createTaskButton(app) {
        const task = document.createElement("button");
        task.className = "taskbar-button taskbar-app";
        task.type = "button";
        task.dataset.appId = app.id;
        task.innerHTML = `${appIcon(app)}<span>${taskbarLabel(app)}</span>`;
        task.setAttribute("aria-label", app.name);
        task.title = app.name;
        return task;
    }

    function ensurePinnedButton(appId) {
        if (pinnedButtons.has(appId)) return pinnedButtons.get(appId);
        const definition = apps.find((item) => item.id === appId);
        if (!definition) return null;
        const button = createTaskButton(definition);
        button.classList.add("taskbar-pinned");
        pinnedButtons.set(appId, button);
        return button;
    }

    function renderPinnedApps() {
        pinned.forEach((appId) => {
            const button = ensurePinnedButton(appId);
            if (button) taskbar.append(button);
        });
        syncTaskbarOrder();
    }

    function syncTaskbarOrder() {
        const order = [];
        pinned.forEach((appId) => {
            const button = pinnedButtons.get(appId);
            if (button) order.push(button);
        });
        windows.forEach((record) => {
            if (!isPinned(record.app.id) && !order.includes(record.task)) order.push(record.task);
        });
        order.forEach((node) => taskbar.append(node));
        syncTaskbarLayout();
    }

    function persistPinnedOrder() {
        const order = [...taskbar.querySelectorAll(".taskbar-app")]
            .map((node) => node.dataset.appId)
            .filter((id) => pinned.includes(id));
        const next = order.concat(pinned.filter((id) => !order.includes(id)));
        if (JSON.stringify(next) !== JSON.stringify(pinned)) {
            pinned = next;
            savePinned();
        }
    }

    function pin(appId) {
        if (isPinned(appId)) return;
        pinned.push(appId);
        savePinned();
        const button = ensurePinnedButton(appId);
        if (!button) return;
        const running = [...windows.values()].find((item) => item.app.id === appId);
        if (running) {
            running.task.remove();
            running.task = button;
            syncWindowTaskState(running);
        }
        renderPinnedApps();
    }

    function unpin(appId) {
        if (!isPinned(appId)) return;
        pinned = pinned.filter((id) => id !== appId);
        savePinned();
        const button = pinnedButtons.get(appId);
        if (button) button.remove();
        pinnedButtons.delete(appId);
        const running = [...windows.values()].find((item) => item.app.id === appId);
        if (running) {
            running.task = createTaskButton(running.app);
            taskbar.append(running.task);
            syncWindowTaskState(running);
        }
        syncTaskbarOrder();
    }

    function syncWindowTaskState(record) {
        record.task.classList.toggle("is-minimized", record.state === "minimized");
        if (record.state === "minimized") {
            record.task.setAttribute("aria-pressed", "false");
        } else {
            focus(record.id);
        }
    }

    function activateApp(appId) {
        const record = [...windows.values()].find((item) => item.app.id === appId);
        if (!record) { openApp(appId); return; }
        if (record.state === "minimized" || !record.element.classList.contains("is-active")) setState(record.id, "normal");
        else minimize(record.id);
    }

    function setTitle(id, title) {
        const record = windows.get(id);
        const nextTitle = String(title || record?.app.name || "Luma OS").trim();
        if (!record || !nextTitle) return;
        record.app.name = nextTitle;
        record.element.setAttribute("aria-label", nextTitle);
        record.element.querySelector(".window-heading > span:last-child").textContent = nextTitle;
        record.task.querySelector("span:last-child").textContent = taskbarLabel(record.app, nextTitle);
        record.task.setAttribute("aria-label", nextTitle);
        record.task.title = nextTitle;
        emitChange();
    }

    function focus(id) {
        const record = windows.get(id);
        if (!record || record.state === "minimized") return;
        windows.forEach((item) => {
            item.element.classList.remove("is-active");
            item.task.classList.remove("is-active");
            item.task.setAttribute("aria-pressed", "false");
        });
        record.element.classList.add("is-active");
        record.element.style.zIndex = String(++topZ);
        record.task.classList.add("is-active");
        record.task.setAttribute("aria-pressed", "true");
    }

    function refreshRunningState() {
        const runningIds = new Set([...windows.values()].map((item) => item.app.id));
        windows.forEach((item) => item.task.classList.add("is-running"));
        pinnedButtons.forEach((button, appId) => {
            button.classList.toggle("is-running", runningIds.has(appId));
        });
    }

    function rememberBounds(record) {
        const rect = record.element.getBoundingClientRect();
        record.bounds = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    }

    function restoreBounds(record) {
        if (!record.bounds) return;
        const bounds = constrainBounds(record, record.bounds);
        Object.assign(record.element.style, {
            left: `${bounds.left}px`, top: `${bounds.top}px`,
            width: `${bounds.width}px`, height: `${bounds.height}px`
        });
    }

    function constrainBounds(record, bounds) {
        const availableWidth = Math.max(1, layer.clientWidth || window.innerWidth);
        const availableHeight = Math.max(1, layer.clientHeight || window.innerHeight - 76);
        const margin = availableWidth > 720 ? 8 : 4;
        const minWidth = Math.min(record.app.minWidth || 360, Math.max(1, availableWidth - margin * 2));
        const minHeight = Math.min(record.app.minHeight || 300, Math.max(1, availableHeight - margin * 2));
        const width = Math.min(Math.max(bounds.width, minWidth), Math.max(minWidth, availableWidth - margin * 2));
        const height = Math.min(Math.max(bounds.height, minHeight), Math.max(minHeight, availableHeight - margin * 2));
        return {
            width,
            height,
            left: Math.min(Math.max(margin, bounds.left), Math.max(margin, availableWidth - width - margin)),
            top: Math.min(Math.max(margin, bounds.top), Math.max(margin, availableHeight - height - margin))
        };
    }

    function snapshot() {
        return [...windows.values()].map((record) => ({
            id: record.id,
            instanceKey: record.instanceKey,
            appId: record.app.id,
            name: record.app.name,
            icon: record.app.icon,
            logo: record.app.logo || null,
            state: record.state,
            startedAt: record.startedAt,
            options: serializable(record.options),
            bounds: boundsOf(record)
        }));
    }

    function serializable(value) {
        if (value == null || typeof value !== "object") return value;
        if (Array.isArray(value)) return value.map(serializable);
        const out = {};
        for (const key of Object.keys(value)) {
            const item = value[key];
            if (item == null || typeof item === "function") continue;
            if (typeof item === "object" && !(item instanceof Blob) && !(item instanceof File)) out[key] = serializable(item);
            else out[key] = item;
        }
        return out;
    }

    function boundsOf(record) {
        const rect = record.element.getBoundingClientRect();
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    }

    function hasSavedSession() {
        try {
            const saved = JSON.parse(localStorage.getItem(SESSION_KEY) || "[]");
            return Array.isArray(saved) && saved.length > 0;
        } catch { return false; }
    }

    function persistSession() {
        const data = snapshot();
        try { localStorage.setItem(SESSION_KEY, JSON.stringify(data)); } catch { /* stockage indisponible ou saturé */ }
        onSessionChange(data);
    }

    function restoreSession(saved) {
        let entries = saved;
        if (!Array.isArray(entries)) {
            try { entries = JSON.parse(localStorage.getItem(SESSION_KEY) || "[]"); } catch { entries = []; }
        }
        if (!Array.isArray(entries)) return 0;
        let restored = 0;
        entries.forEach((entry, index) => {
            const definition = apps.find((item) => item.id === entry.appId);
            if (!definition) return;
            const options = {
                instanceKey: entry.instanceKey,
                title: entry.name,
                data: entry.options?.data,
                state: entry.state
            };
            const id = openApp(entry.appId, options, { bounds: entry.bounds });
            if (!id) return;
            restored += 1;
            const record = windows.get(id);
            if (record && entry.bounds && entry.state !== "maximized" && entry.state !== "snap-left" && entry.state !== "snap-right") {
                record.bounds = constrainBounds(record, entry.bounds);
                restoreBounds(record);
            }
            if (index === saved.length - 1 && record) focus(id);
        });
        return restored;
    }

    function emitChange() {
        syncTaskbarLayout();
        refreshRunningState();
        window.dispatchEvent(new CustomEvent("luma:windows", { detail: snapshot() }));
        persistSession();
    }

    function setState(id, state) {
        const record = windows.get(id);
        if (!record) return;
        if (record.state === "normal" && state !== "minimized") rememberBounds(record);
        if (state === "normal") restoreBounds(record);
        record.state = state;
        record.element.dataset.state = state;
        record.task.classList.toggle("is-minimized", state === "minimized");
        const maxIcon = state === "normal" ? "maximize" : "restore";
        record.element.querySelector('[data-window-action="maximize"]').innerHTML = icon(maxIcon);
        record.element.querySelector('[data-window-action="maximize"]').ariaLabel = state === "normal" ? "Agrandir" : "Restaurer";
        if (state === "minimized") {
            record.task.setAttribute("aria-pressed", "false");
            record.element.classList.remove("is-active");
        } else {
            focus(id);
        }
        emitChange();
    }

    function minimize(id) { setState(id, "minimized"); }

    function toggleMaximize(id) {
        const record = windows.get(id);
        setState(id, record.state === "maximized" ? "normal" : "maximized");
    }

    function close(id) {
        const record = windows.get(id);
        if (!record) return;
        record.cleanup?.();
        record.element.remove();
        if (pinnedButtons.has(record.app.id)) {
            record.task.classList.remove("is-active", "is-minimized");
            record.task.setAttribute("aria-pressed", "false");
        } else {
            record.task.remove();
        }
        windows.delete(id);
        syncTaskbarOrder();
        emitChange();
        const next = [...windows.values()].filter((item) => item.state !== "minimized").sort((a, b) => Number(b.element.style.zIndex) - Number(a.element.style.zIndex))[0];
        if (next) focus(next.id);
    }

    function createDrag(record, handle) {
        handle.addEventListener("pointerdown", (event) => {
            if (event.button !== 0 || event.target.closest("button")) return;
            if (record.state !== "normal") setState(record.id, "normal");
            focus(record.id);
            const start = record.element.getBoundingClientRect();
            const offsetX = event.clientX - start.left;
            const offsetY = event.clientY - start.top;
            handle.setPointerCapture(event.pointerId);

            const move = (moveEvent) => {
                const maxLeft = Math.max(0, window.innerWidth - start.width);
                const maxTop = Math.max(0, layer.clientHeight - start.height);
                record.element.style.left = `${Math.min(maxLeft, Math.max(0, moveEvent.clientX - offsetX))}px`;
                record.element.style.top = `${Math.min(maxTop, Math.max(0, moveEvent.clientY - offsetY))}px`;
            };
            const end = (upEvent) => {
                handle.removeEventListener("pointermove", move);
                handle.removeEventListener("pointerup", end);
                if (upEvent.clientY <= 10) setState(record.id, "maximized");
                else if (upEvent.clientX <= 10) setState(record.id, "snap-left");
                else if (upEvent.clientX >= window.innerWidth - 10) setState(record.id, "snap-right");
                else rememberBounds(record);
                persistSession();
            };
            handle.addEventListener("pointermove", move);
            handle.addEventListener("pointerup", end);
        });
        handle.addEventListener("dblclick", () => toggleMaximize(record.id));
    }

    function createResize(record, handle, direction) {
        handle.addEventListener("pointerdown", (event) => {
            if (record.state !== "normal") return;
            event.preventDefault();
            event.stopPropagation();
            focus(record.id);
            const start = record.element.getBoundingClientRect();
            handle.setPointerCapture(event.pointerId);
            const move = (moveEvent) => {
                const dx = moveEvent.clientX - event.clientX;
                const dy = moveEvent.clientY - event.clientY;
                const availableWidth = layer.clientWidth;
                const availableHeight = layer.clientHeight;
                const minWidth = Math.min(record.app.minWidth || 360, availableWidth - 8);
                const minHeight = Math.min(record.app.minHeight || 300, availableHeight - 8);
                const right = start.right;
                const bottom = start.bottom;
                let left = start.left;
                let top = start.top;
                let width = start.width;
                let height = start.height;
                if (direction.includes("e")) width = Math.min(Math.max(minWidth, start.width + dx), availableWidth - start.left - 4);
                if (direction.includes("s")) height = Math.min(Math.max(minHeight, start.height + dy), availableHeight - start.top - 4);
                if (direction.includes("w")) { left = Math.min(Math.max(4, start.left + dx), right - minWidth); width = right - left; }
                if (direction.includes("n")) { top = Math.min(Math.max(4, start.top + dy), bottom - minHeight); height = bottom - top; }
                Object.assign(record.element.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px` });
            };
            const end = () => {
                handle.removeEventListener("pointermove", move);
                handle.removeEventListener("pointerup", end);
                rememberBounds(record);
                persistSession();
            };
            handle.addEventListener("pointermove", move);
            handle.addEventListener("pointerup", end);
        });
    }

    async function mountContent(record) {
        record.content.setAttribute("aria-busy", "true");
        record.content.innerHTML = '<p class="app-loading">Ouverture de l’application…</p>';
        try {
            const module = await import(record.app.module);
            record.content.innerHTML = "";
            record.cleanup = await module.mount(record.content, {
                app: record.app,
                close: () => close(record.id),
                open: openApp,
                apps: apps.filter((item) => !item.hidden).map(({ module, ...item }) => ({ ...item })),
                registry: apps.map(({ module, ...item }) => ({ ...item })),
                windowId: record.id,
                getWindows: snapshot,
                closeWindow: close,
                options: record.options,
                setTitle: (title) => setTitle(record.id, title),
                toast: onToast,
                version
            });
        } catch (error) {
            record.content.innerHTML = `<div class="app-error"><h2>Impossible d’ouvrir ${record.app.name}</h2><p>${error.message}</p></div>`;
        } finally {
            record.content.removeAttribute("aria-busy");
        }
    }

    function openApp(appId, options = {}, initial = null) {
        const definition = apps.find((item) => item.id === appId);
        if (!definition) return null;
        const instanceKey = options.instanceKey || appId;
        const existing = [...windows.values()].find((item) => item.instanceKey === instanceKey);
        if (existing) {
            if (existing.state === "minimized") setState(existing.id, "normal");
            focus(existing.id);
            return existing.id;
        }

        const app = { ...definition, name: options.title || definition.name, data: options.data };

        const id = `luma-window-${crypto.randomUUID()}`;
        const element = document.createElement("article");
        element.className = "luma-window";
        element.id = id;
        element.dataset.state = options.state || "normal";
        element.setAttribute("aria-label", app.name);
        if (initial?.bounds) {
            const bounds = constrainBounds({ app }, initial.bounds);
            element.style.width = `${bounds.width}px`;
            element.style.height = `${bounds.height}px`;
            element.style.left = `${bounds.left}px`;
            element.style.top = `${bounds.top}px`;
        } else {
            element.style.width = `${Math.min(app.width || 900, window.innerWidth - 48)}px`;
            element.style.height = `${Math.min(app.height || 660, window.innerHeight - 112)}px`;
            element.style.left = `${Math.max(12, Math.min(window.innerWidth - 380, window.innerWidth * (app.position?.left ?? .13) + cascade * 18))}px`;
            element.style.top = `${Math.max(8, Math.min(window.innerHeight - 360, window.innerHeight * (app.position?.top ?? .07) + cascade * 14))}px`;
        }
        element.innerHTML = `
            <header class="window-titlebar">
                <div class="window-heading">${appIcon(app)}<span>${app.name}</span></div>
                <div class="window-drag-region" aria-hidden="true"></div>
                <div class="window-controls">
                    <button class="window-control" type="button" data-window-action="minimize" aria-label="Réduire">${icon("minus")}</button>
                    <button class="window-control" type="button" data-window-action="maximize" aria-label="Agrandir">${icon("maximize")}</button>
                    <button class="window-control window-control--close" type="button" data-window-action="close" aria-label="Fermer">${icon("close")}</button>
                </div>
            </header>
            <div class="window-content"></div>
            ${["n", "e", "s", "w", "ne", "se", "sw", "nw"].map((direction) => `<div class="window-resize window-resize--${direction}" data-resize="${direction}" aria-hidden="true"></div>`).join("")}`;
        layer.append(element);

        let task = pinnedButtons.get(appId);
        if (!task) {
            task = createTaskButton(app);
            taskbar.append(task);
        }

        const record = { id, instanceKey, options, app, element, task, content: element.querySelector(".window-content"), state: options.state || "normal", bounds: null, startedAt: new Date().toISOString() };
        windows.set(id, record);
        cascade = (cascade + 1) % 7;
        createDrag(record, element.querySelector(".window-titlebar"));
        element.querySelectorAll("[data-resize]").forEach((handle) => createResize(record, handle, handle.dataset.resize));
        element.addEventListener("pointerdown", () => focus(id));
        element.querySelector('[data-window-action="minimize"]').addEventListener("click", () => minimize(id));
        element.querySelector('[data-window-action="maximize"]').addEventListener("click", () => toggleMaximize(id));
        element.querySelector('[data-window-action="close"]').addEventListener("click", () => close(id));
        setState(id, record.state);
        mountContent(record);
        syncTaskbarOrder();
        emitChange();
        return id;
    }

    window.addEventListener("resize", () => {
        syncTaskbarLayout();
        windows.forEach((record) => {
        if (record.state === "normal") {
            const rect = record.element.getBoundingClientRect();
            const bounds = constrainBounds(record, rect);
            Object.assign(record.element.style, { left: `${bounds.left}px`, top: `${bounds.top}px`, width: `${bounds.width}px`, height: `${bounds.height}px` });
        }
        });
    });

    let dragged = null;
    let dragStartX = 0;
    let dragMoved = false;

    function onTaskbarPointerDown(event) {
        if (event.button !== 0) return;
        const button = event.target.closest(".taskbar-app");
        if (!button) return;
        dragged = button;
        dragStartX = event.clientX;
        dragMoved = false;
        button.setPointerCapture(event.pointerId);
    }

    function onTaskbarPointerMove(event) {
        if (!dragged) return;
        if (!dragMoved && Math.abs(event.clientX - dragStartX) < 8) return;
        if (!dragMoved) {
            dragMoved = true;
            dragged.classList.add("is-dragging");
            taskbar.dataset.dragging = "true";
        }
        const siblings = [...taskbar.querySelectorAll(".taskbar-app")].filter((node) => node !== dragged);
        let insertBefore = null;
        for (const sibling of siblings) {
            const rect = sibling.getBoundingClientRect();
            if (event.clientX < rect.left + rect.width / 2) { insertBefore = sibling; break; }
        }
        taskbar.insertBefore(dragged, insertBefore);
    }

    function onTaskbarPointerUp() {
        if (!dragged) return;
        dragged.classList.remove("is-dragging");
        delete taskbar.dataset.dragging;
        if (dragMoved) {
            dragged.dataset.dragged = "1";
            persistPinnedOrder();
            syncTaskbarOrder();
        }
        dragged = null;
        dragMoved = false;
    }

    taskbar.addEventListener("pointerdown", onTaskbarPointerDown);
    taskbar.addEventListener("pointermove", onTaskbarPointerMove);
    taskbar.addEventListener("pointerup", onTaskbarPointerUp);
    taskbar.addEventListener("pointercancel", onTaskbarPointerUp);

    taskbar.addEventListener("click", (event) => {
        const button = event.target.closest(".taskbar-app");
        if (!button) return;
        if (button.dataset.dragged === "1") { delete button.dataset.dragged; return; }
        activateApp(button.dataset.appId);
    });

    taskbar.addEventListener("contextmenu", (event) => {
        const button = event.target.closest(".taskbar-app");
        if (!button) return;
        event.preventDefault();
        const appId = button.dataset.appId;
        const definition = apps.find((item) => item.id === appId);
        if (!definition) return;
        const running = [...windows.values()].find((item) => item.app.id === appId);
        showContextMenu(event.clientX, event.clientY, [
            { label: "Ouvrir", action: () => activateApp(appId) },
            running ? { label: "Fermer la fenêtre", action: () => close(running.id) } : null,
            "separator",
            isPinned(appId)
                ? { label: "Détaché de la barre des tâches", action: () => unpin(appId) }
                : { label: "Attaché à la barre des tâches", action: () => pin(appId) }
        ].filter(Boolean));
    });

    renderPinnedApps();
    syncTaskbarLayout();

    function setAppState(appId, state) {
        const record = [...windows.values()].find((item) => item.app.id === appId);
        if (record) setState(record.id, state);
    }

    return { openApp, close, minimize, focus, setState, setAppState, setTitle, getWindows: snapshot, windows, saveSession: persistSession, restoreSession, hasSavedSession };
}
