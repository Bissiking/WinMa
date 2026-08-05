const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;

export function createWindowManager({ layer, taskbar, apps, onToast }) {
    const windows = new Map();
    let topZ = 10;
    let cascade = 0;

    function appIcon(app) {
        return `<span class="app-icon app-icon--${app.icon}">${icon(app.icon === "settings" ? "settings" : app.icon === "trash" ? "trash" : "folder")}</span>`;
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
        Object.assign(record.element.style, {
            left: `${record.bounds.left}px`, top: `${record.bounds.top}px`,
            width: `${record.bounds.width}px`, height: `${record.bounds.height}px`
        });
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
                const maxTop = Math.max(0, window.innerHeight - 76 - 46);
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

    function createResize(record, handle) {
        handle.addEventListener("pointerdown", (event) => {
            if (record.state !== "normal") return;
            event.preventDefault();
            const start = record.element.getBoundingClientRect();
            handle.setPointerCapture(event.pointerId);
            const move = (moveEvent) => {
                record.element.style.width = `${Math.max(record.app.minWidth || 360, start.width + moveEvent.clientX - event.clientX)}px`;
                record.element.style.height = `${Math.max(record.app.minHeight || 300, start.height + moveEvent.clientY - event.clientY)}px`;
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
                toast: onToast
            });
        } catch (error) {
            record.content.innerHTML = `<div class="app-error"><h2>Impossible d’ouvrir ${record.app.name}</h2><p>${error.message}</p></div>`;
        } finally {
            record.content.removeAttribute("aria-busy");
        }
    }

    function openApp(appId, options = {}) {
        const app = apps.find((item) => item.id === appId);
        if (!app) return null;
        const existing = [...windows.values()].find((item) => item.app.id === appId);
        if (existing) {
            if (existing.state === "minimized") setState(existing.id, "normal");
            focus(existing.id);
            return existing.id;
        }

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
            <div class="window-resize" aria-hidden="true"></div>`;
        layer.append(element);

        const task = document.createElement("button");
        task.className = "taskbar-button taskbar-app";
        task.type = "button";
        task.innerHTML = `${appIcon(app)}<span>${app.name}</span>`;
        task.setAttribute("aria-label", app.name);
        taskbar.append(task);

        const record = { id, app, element, task, content: element.querySelector(".window-content"), state: options.state || "normal", bounds: null };
        windows.set(id, record);
        cascade = (cascade + 1) % 7;
        createDrag(record, element.querySelector(".window-titlebar"));
        createResize(record, element.querySelector(".window-resize"));
        element.addEventListener("pointerdown", () => focus(id));
        element.querySelector('[data-window-action="minimize"]').addEventListener("click", () => minimize(id));
        element.querySelector('[data-window-action="maximize"]').addEventListener("click", () => toggleMaximize(id));
        element.querySelector('[data-window-action="close"]').addEventListener("click", () => close(id));
        task.addEventListener("click", () => record.state === "minimized" || !record.element.classList.contains("is-active") ? setState(id, "normal") : minimize(id));
        setState(id, record.state);
        mountContent(record);
        return id;
    }

    window.addEventListener("resize", () => windows.forEach((record) => {
        if (record.state === "normal") {
            const rect = record.element.getBoundingClientRect();
            record.element.style.left = `${Math.max(0, Math.min(rect.left, window.innerWidth - rect.width))}px`;
            record.element.style.top = `${Math.max(0, Math.min(rect.top, window.innerHeight - 76 - rect.height))}px`;
        }
    }));

    function setAppState(appId, state) {
        const record = [...windows.values()].find((item) => item.app.id === appId);
        if (record) setState(record.id, state);
    }

    return { openApp, close, minimize, focus, setState, setAppState, windows };
}
