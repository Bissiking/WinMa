import { requestJson } from "/assets/javascripts/luma-api.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;

function formatBytes(value) {
    if (!Number.isFinite(value)) return "—";
    const units = ["o", "Ko", "Mo", "Go", "To"];
    let amount = value;
    let index = 0;
    while (amount >= 1024 && index < units.length - 1) { amount /= 1024; index += 1; }
    return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: index > 2 ? 1 : 0 }).format(amount)} ${units[index]}`;
}

function formatPercent(value) {
    return Number.isFinite(value) ? `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value)} %` : "—";
}

function appMark(app) {
    if (app.logo) return `<span class="task-app-mark task-app-mark--logo"><img src="${app.logo}" alt=""></span>`;
    const symbols = { settings: "settings", trash: "trash", notepad: "notepad", image: "image", activity: "activity", orbit: "orbit", chip: "chip" };
    return `<span class="task-app-mark task-app-mark--${app.icon}">${icon(symbols[app.icon] || "folder")}</span>`;
}

export async function mount(root, { apps, windowId, getWindows, closeWindow, toast }) {
    let view = "processes";
    let metrics = null;
    let metricsError = false;
    let startupIds;
    try { startupIds = new Set(JSON.parse(localStorage.getItem("luma.startup-apps") || "[]")); } catch { startupIds = new Set(); }

    root.innerHTML = `
        <div class="task-manager-app">
            <aside class="task-manager-nav">
                <div class="task-manager-brand">${icon("activity")}<strong>Activité</strong></div>
                <nav aria-label="Sections du gestionnaire">
                    <button class="is-current" type="button" data-task-view="processes">${icon("device")}<span>Processus</span></button>
                    <button type="button" data-task-view="performance">${icon("activity")}<span>Performances</span></button>
                    <button type="button" data-task-view="startup">${icon("play")}<span>Démarrage</span></button>
                    <button type="button" data-task-view="users">${icon("user")}<span>Utilisateurs</span></button>
                </nav>
                <small>Données système actualisées toutes les 2 secondes.</small>
            </aside>
            <main class="task-manager-main">
                <header class="task-manager-heading"><div><h1>Gestionnaire des tâches</h1><p data-task-description>Applications ouvertes dans cette session.</p></div><button type="button" data-task-refresh>${icon("sync")} Actualiser</button></header>
                <div class="task-manager-summary" aria-label="Résumé système"></div>
                <section class="task-manager-view" aria-live="polite"></section>
            </main>
        </div>`;

    const viewRoot = root.querySelector(".task-manager-view");
    const summary = root.querySelector(".task-manager-summary");
    const description = root.querySelector("[data-task-description]");

    function windows() { return getWindows().sort((a, b) => a.name.localeCompare(b.name, "fr")); }

    function renderSummary() {
        const processes = windows();
        summary.innerHTML = `
            <div><span>Applications</span><strong>${processes.length}</strong></div>
            <div><span>CPU</span><strong>${formatPercent(metrics?.cpu?.percent)}</strong></div>
            <div><span>Mémoire</span><strong>${formatPercent(metrics?.memory?.percent)}</strong></div>
            <div><span>Session</span><strong>${escapeHtml(metrics?.user?.displayName || metrics?.user?.username || "Active")}</strong></div>`;
    }

    function renderProcesses() {
        const rows = windows();
        viewRoot.innerHTML = `<div class="task-table task-processes">
            <div class="task-table__head"><span>Nom</span><span>État</span><span>Démarrée</span><span></span></div>
            ${rows.map((process) => `<div class="task-table__row" data-process-id="${process.id}">
                <span class="task-process-name">${appMark(process)}<strong>${escapeHtml(process.name)}</strong></span>
                <span><i class="task-state task-state--${process.state}"></i>${process.state === "minimized" ? "Réduite" : process.state === "maximized" ? "Agrandie" : process.state.startsWith("snap") ? "Ancrée" : "Ouverte"}</span>
                <time datetime="${process.startedAt}">${new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(process.startedAt))}</time>
                <button type="button" data-end-process="${process.id}" ${process.id === windowId ? "disabled title=\"Le Gestionnaire ne peut pas s’arrêter lui-même\"" : ""}>Terminer</button>
            </div>`).join("")}</div>`;
    }

    function renderPerformance() {
        const cpu = metrics?.cpu;
        const memory = metrics?.memory;
        viewRoot.innerHTML = metricsError && !metrics ? `<div class="task-manager-empty"><h2>Métriques indisponibles</h2><p>Redémarrez le serveur Luma OS pour activer la nouvelle route système.</p><button type="button" data-task-refresh>Réessayer</button></div>` : `
            <div class="performance-panel">
                <section><header><div><h2>Processeur</h2><p>${cpu?.logicalCores || "—"} processeurs logiques</p></div><strong>${formatPercent(cpu?.percent)}</strong></header><div class="performance-track"><i style="transform:scaleX(${(cpu?.percent || 0) / 100})"></i></div><dl><div><dt>Charge 1 min</dt><dd>${cpu?.loadAverage?.[0] ?? "—"}</dd></div><div><dt>Charge 5 min</dt><dd>${cpu?.loadAverage?.[1] ?? "—"}</dd></div><div><dt>Charge 15 min</dt><dd>${cpu?.loadAverage?.[2] ?? "—"}</dd></div></dl></section>
                <section><header><div><h2>Mémoire</h2><p>${formatBytes(memory?.usedBytes)} utilisés sur ${formatBytes(memory?.totalBytes)}</p></div><strong>${formatPercent(memory?.percent)}</strong></header><div class="performance-track performance-track--memory"><i style="transform:scaleX(${(memory?.percent || 0) / 100})"></i></div><dl><div><dt>Disponible</dt><dd>${formatBytes(memory?.availableBytes)}</dd></div><div><dt>Serveur Luma</dt><dd>${formatBytes(metrics?.runtime?.processMemoryBytes)}</dd></div><div><dt>Disponibilité</dt><dd>${metrics?.runtime?.uptimeSeconds ? `${Math.floor(metrics.runtime.uptimeSeconds / 60)} min` : "—"}</dd></div></dl></section>
            </div>`;
    }

    function renderStartup() {
        const eligible = apps.filter((app) => !["task-manager", "image-viewer"].includes(app.id));
        viewRoot.innerHTML = `<div class="startup-list"><header><h2>Applications au démarrage</h2><p>Elles s’ouvriront automatiquement à la prochaine session Luma OS.</p></header>${eligible.map((app) => `<label>${appMark(app)}<span><strong>${escapeHtml(app.name)}</strong><small>${startupIds.has(app.id) ? "Activée" : "Désactivée"}</small></span><input type="checkbox" data-startup-app="${app.id}" ${startupIds.has(app.id) ? "checked" : ""}></label>`).join("")}</div>`;
    }

    function renderUsers() {
        const user = metrics?.user;
        viewRoot.innerHTML = `<div class="users-panel"><header><h2>Utilisateur actif</h2><p>Session authentifiée par Kyros.</p></header><div><span class="task-user-avatar">${escapeHtml((user?.displayName || user?.username || "L").charAt(0).toLocaleUpperCase("fr"))}</span><span><strong>${escapeHtml(user?.displayName || "Utilisateur Luma")}</strong><small>@${escapeHtml(user?.username || "session-active")}</small></span><span class="task-user-status"><i></i> Actif</span></div></div>`;
    }

    function render() {
        renderSummary();
        root.querySelectorAll("[data-task-view]").forEach((button) => button.classList.toggle("is-current", button.dataset.taskView === view));
        const descriptions = { processes: "Applications ouvertes dans cette session.", performance: "Charge du serveur qui exécute Luma OS.", startup: "Applications lancées avec votre session.", users: "Identité actuellement connectée." };
        description.textContent = descriptions[view];
        if (view === "processes") renderProcesses();
        else if (view === "performance") renderPerformance();
        else if (view === "startup") renderStartup();
        else renderUsers();
    }

    async function loadMetrics() {
        try { metrics = await requestJson("/api/system/metrics"); metricsError = false; }
        catch { metricsError = true; }
        render();
    }

    const onWindows = () => render();
    const onClick = (event) => {
        const nextView = event.target.closest("[data-task-view]")?.dataset.taskView;
        const processId = event.target.closest("[data-end-process]")?.dataset.endProcess;
        if (nextView) { view = nextView; render(); }
        else if (processId) { closeWindow(processId); toast?.("Application arrêtée."); }
        else if (event.target.closest("[data-task-refresh]")) loadMetrics();
    };
    const onChange = (event) => {
        const id = event.target.dataset.startupApp;
        if (!id) return;
        event.target.checked ? startupIds.add(id) : startupIds.delete(id);
        localStorage.setItem("luma.startup-apps", JSON.stringify([...startupIds]));
        renderStartup();
    };

    window.addEventListener("luma:windows", onWindows);
    root.addEventListener("click", onClick);
    root.addEventListener("change", onChange);
    await loadMetrics();
    const interval = window.setInterval(loadMetrics, 2000);
    return () => {
        window.clearInterval(interval);
        window.removeEventListener("luma:windows", onWindows);
        root.removeEventListener("click", onClick);
        root.removeEventListener("change", onChange);
    };
}
