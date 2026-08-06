const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;

export function createWindowManager({ layer, taskbar, apps, onToast }) {
    const windows = new Map();
    let topZ = 10;
    let cascade = 0;

    function syncTaskbarLayout() {
        const count = windows.size;
        const viewport = window.innerWidth;
        const reservedWidth = viewport <= 720 ? 206 : viewport <= 1100 ? 340 : 470;
        const availablePerApp = count ? Math.max(0, viewport - 24 - reservedWidth) / count : Infinity;
        const layout = count >= 8 || availablePerApp < 94
            ? "icons"
            : count >= 6 || availablePerApp < 138 ? "compact" : "labels";
        taskbar.dataset.count = String(count);
        taskbar.dataset.layout = layout;
        taskbar.closest(".taskbar")?.setAttribute("data-app-layout", layout);
    }

    function appIcon(app) {
        if (app.logo) return `<span class="app-icon app-icon--image-logo"><img src="${app.logo}" alt=""></span>`;
        const symbols = { settings: "settings", trash: "trash", notepad: "notepad", image: "image", activity: "activity", orbit: "orbit", chip: "chip" };
        return `<span class="app-icon app-icon--${app.icon}">${icon(symbols[app.icon] || "folder")}</span>`;
    }

    function taskbarLabel(app, title = app.name) {
        if (app.taskbarName) return app.taskbarName;
        const characters = Array.from(String(title || "App").trim());
        return characters.length <= 6 ? characters.join("") : `${characters.slice(0, 5).join("")}…`;
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
            startedAt: record.startedAt
        }));
    }

    function emitChange() {
        syncTaskbarLayout();
        window.dispatchEvent(new CustomEvent("luma:windows", { detail: snapshot() }));
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
        record.task.remove();
        windows.delete(id);
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
                windowId: record.id,
                getWindows: snapshot,
                closeWindow: close,
                options: record.options,
                setTitle: (title) => setTitle(record.id, title),
                toast: onToast
            });
        } catch (error) {
            record.content.innerHTML = `<div class="app-error"><h2>Impossible d’ouvrir ${record.app.name}</h2><p>${error.message}</p></div>`;
        } finally {
            record.content.removeAttribute("aria-busy");
        }
    }

    function openApp(appId, options = {}) {
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
        element.style.width = `${Math.min(app.width || 900, window.innerWidth - 48)}px`;
        element.style.height = `${Math.min(app.height || 660, window.innerHeight - 112)}px`;
        element.style.left = `${Math.max(12, Math.min(window.innerWidth - 380, window.innerWidth * (app.position?.left ?? .13) + cascade * 18))}px`;
        element.style.top = `${Math.max(8, Math.min(window.innerHeight - 360, window.innerHeight * (app.position?.top ?? .07) + cascade * 14))}px`;
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

        const task = document.createElement("button");
        task.className = "taskbar-button taskbar-app";
        task.type = "button";
        task.innerHTML = `${appIcon(app)}<span>${taskbarLabel(app)}</span>`;
        task.setAttribute("aria-label", app.name);
        task.title = app.name;
        taskbar.append(task);

        const record = { id, instanceKey, options, app, element, task, content: element.querySelector(".window-content"), state: options.state || "normal", bounds: null, startedAt: new Date().toISOString() };
        windows.set(id, record);
        cascade = (cascade + 1) % 7;
        createDrag(record, element.querySelector(".window-titlebar"));
        element.querySelectorAll("[data-resize]").forEach((handle) => createResize(record, handle, handle.dataset.resize));
        element.addEventListener("pointerdown", () => focus(id));
        element.querySelector('[data-window-action="minimize"]').addEventListener("click", () => minimize(id));
        element.querySelector('[data-window-action="maximize"]').addEventListener("click", () => toggleMaximize(id));
        element.querySelector('[data-window-action="close"]').addEventListener("click", () => close(id));
        task.addEventListener("click", () => record.state === "minimized" || !record.element.classList.contains("is-active") ? setState(id, "normal") : minimize(id));
        setState(id, record.state);
        mountContent(record);
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

    syncTaskbarLayout();

    function setAppState(appId, state) {
        const record = [...windows.values()].find((item) => item.app.id === appId);
        if (record) setState(record.id, state);
    }

    return { openApp, close, minimize, focus, setState, setAppState, setTitle, getWindows: snapshot, windows };
}
