const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;

const views = [
    { id: "overview", label: "Vue d’ensemble", icon: "device" },
    { id: "cpu", label: "Processeurs", icon: "chip" },
    { id: "memory", label: "Mémoire & stockage", icon: "folder" },
    { id: "power", label: "Alimentation", icon: "activity" },
    { id: "network", label: "Réseau", icon: "luma-network" },
    { id: "processes", label: "Processus", icon: "sync" },
    { id: "diagnostic", label: "Diagnostic", icon: "check" }
];

function checkList(items, negative = false) {
    return `<ul class="ms-check-list">${items.map((item) => `<li>${icon(negative ? "close" : "check")}<span>${item}</span></li>`).join("")}</ul>`;
}

function metric(label, value, detail = "") {
    return `<div class="ms-metric"><span>${label}</span><strong>${value}</strong>${detail ? `<small>${detail}</small>` : ""}</div>`;
}

function renderOverview() {
    return `
        <section class="ms-overview">
            <div class="ms-hero">
                <div><span class="ms-chip-visual">${icon("chip")}<i>MS</i></span><div><h1>Workstation Cognitive <strong>Mk.26.8</strong></h1><span>Matheo.exe v26.8 · Autopilot Professional · Hybrid Cognitive x64</span></div></div>
                <div class="ms-survival-state"><span>Architecture active</span><strong>MODE SURVIE</strong><small>Socket 2 · DDR2 · HDD 5400 RPM</small></div>
            </div>
            <div class="ms-performance-strip">
                <div><span>Capacité disponible</span><strong>8 %</strong></div>
                <div class="ms-segment-bar" aria-label="Performance actuelle : 8 pour cent"><i></i></div>
                <p>Le firmware privilégie actuellement la disponibilité continue à la performance nominale.</p>
            </div>
            <div class="ms-topology" aria-label="Topologie active du système">
                <section class="ms-hardware-panel ms-hardware-panel--parked"><header><span>SOCKET 1</span><i>ÉCONOMIE D’ÉNERGIE</i></header><h2>AMD Threadripper Cognitive Edition</h2><p>126 cœurs · 252 threads</p><div class="ms-spec-row"><span>Fréquence</span><strong>2,0 → 8,2 GHz</strong></div><div class="ms-spec-row"><span>Profil</span><strong>Turbo Motivation</strong></div><footer>Disponible après recharge prolongée</footer></section>
                <span class="ms-route" aria-hidden="true"><i></i>${icon("chevron")}</span>
                <section class="ms-hardware-panel ms-hardware-panel--active"><header><span>SOCKET 2</span><i>ACTIF</i></header><h2>Intel Pentium Recovery Edition</h2><p>1 cœur · 1 thread</p><div class="ms-spec-row"><span>Mémoire</span><strong>8 Go DDR2</strong></div><div class="ms-spec-row"><span>Stockage</span><strong>HDD · 8 Mo cache</strong></div><footer>Fonctions vitales et processus essentiels</footer></section>
            </div>
            <div class="ms-overview-grid">
                ${metric("Batteries principales", "0 / 4", "Batterie de secours engagée")}
                ${metric("Réseau cognitif", "10 Mb/s", "Limitation volontaire")}
                ${metric("Processus critiques", "4 actifs", "Disponibilité assurée")}
                ${metric("État matériel", "Fonctionnel", "Aucun composant défectueux")}
            </div>
        </section>`;
}

function renderCpu() {
    return `
        <section class="ms-detail-view">
            <header class="ms-view-heading"><div><h1>Architecture processeur</h1><p>Deux sockets cognitifs avec bascule énergétique automatique.</p></div><span class="ms-live-badge"><i></i> Socket 2 actif</span></header>
            <div class="ms-cpu-layout">
                <article class="ms-module ms-module--primary"><header><div><span>SOCKET 1 · PRINCIPAL</span><h2>AMD Threadripper Cognitive Edition</h2></div><strong>126C / 252T</strong></header><div class="ms-frequency"><span>Fréquence nominale</span><strong>2,0 GHz</strong><i></i><span>Turbo Motivation</span><strong>8,2 GHz</strong></div><h3>Unités de calcul dédiées</h3>${checkList(["Analyse", "Créativité", "Développement", "Résolution de problèmes", "Vision globale", "Multitâche massif"])}<footer><span>État normal</span><strong>Actif</strong></footer></article>
                <article class="ms-module ms-module--recovery"><header><div><span>SOCKET 2 · SECOURS</span><h2>Intel Pentium Recovery Edition</h2></div><strong>1C / 1T</strong></header><h3>Rôle du contrôleur de secours</h3>${checkList(["Maintien des fonctions vitales", "Travail répétitif", "Exécution minimale", "Mode survie"])}<h3>Déclencheurs automatiques</h3>${checkList(["Fatigue importante", "Surcharge émotionnelle", "Sommeil insuffisant", "Burnout imminent"])}<footer class="is-active"><span>État actuel</span><strong>ACTIF</strong></footer></article>
            </div>
        </section>`;
}

function renderMemory() {
    return `
        <section class="ms-detail-view">
            <header class="ms-view-heading"><div><h1>Mémoire & stockage</h1><p>Allocation dynamique selon l’architecture cognitive active.</p></div></header>
            <div class="ms-memory-map">
                <article class="ms-module"><header><div><span>BANQUE 1</span><h2>128 Go DDR7 ECC</h2></div><strong class="ms-offline">DÉMONTÉE</strong></header>${checkList(["Mémoire de travail", "Cache des projets", "Créativité", "Long contexte"])}<footer><span>Politique</span><strong>Démontage automatique en mode survie</strong></footer></article>
                <article class="ms-module"><header><div><span>BANQUE 2</span><h2>8 Go DDR2</h2></div><strong class="ms-online">EN LIGNE</strong></header><p class="ms-module-copy">Réservée au Socket Pentium. Dimensionnée pour faire tourner uniquement les processus essentiels.</p><div class="ms-memory-usage"><span>Allocation système</span><div><i></i></div><strong>7,6 / 8 Go</strong></div></article>
                <article class="ms-module"><header><div><span>DISQUE PRINCIPAL</span><h2>2 To NVMe Gen6</h2></div><strong class="ms-offline">HORS LIGNE</strong></header><div class="ms-disk-speeds">${metric("Lecture", "14 Go/s")}${metric("Écriture", "12 Go/s")}</div><footer><span>Condition</span><strong>Disponible avec Socket 1</strong></footer></article>
                <article class="ms-module"><header><div><span>DISQUE DE SECOURS</span><h2>HDD 5400 RPM</h2></div><strong class="ms-online">ACTIF</strong></header><div class="ms-disk-speeds">${metric("Cache", "8 Mo")}${metric("Temps d’accès", "Patientez…")}</div><footer><span>Profil</span><strong>Mode survie</strong></footer></article>
            </div>
        </section>`;
}

function renderPower() {
    return `
        <section class="ms-detail-view">
            <header class="ms-view-heading"><div><h1>Alimentation</h1><p>Gestion des quatre modules Lithium et de la réserve d’urgence.</p></div><span class="ms-alert-badge">Alimentation dégradée</span></header>
            <div class="ms-power-layout">
                <div class="ms-battery-bank"><div class="ms-battery-title"><span>${icon("activity")}</span><div><small>ÉTAT NOMINAL</small><strong>100 %</strong></div></div><div class="ms-battery-modules">${[1, 2, 3, 4].map((number) => `<div><span>MODULE ${number}</span><i></i><strong>HS</strong></div>`).join("")}</div><footer><span>Source actuelle</span><strong>Batterie de secours</strong></footer></div>
                <div class="ms-charge-profile"><h2>Profil de recharge</h2><div class="ms-charge-chart" aria-label="Recharge rapide jusqu’à 35 pour cent, puis extrêmement lente"><i></i><b>35 %</b><span>Phase rapide</span><span>Phase extrêmement lente</span></div><p>Recharge très rapide jusqu’à environ 35 %, puis limitation thermique et cognitive automatique.</p><button type="button" data-ms-action="recharge">Démarrer une recharge prolongée</button></div>
            </div>
        </section>`;
}

function renderNetwork() {
    return `
        <section class="ms-detail-view">
            <header class="ms-view-heading"><div><h1>Réseau cognitif</h1><p>Inspection et contrôle des connexions humaines entrantes.</p></div><span class="ms-live-badge"><i></i> Pare-feu actif</span></header>
            <div class="ms-network-layout">
                <section class="ms-network-adapter"><span class="ms-adapter-icon">${icon("luma-network")}</span><div><small>CARTE ACTIVE</small><h2>10 Gigabit Cognitive LAN</h2><p>Débit physique maximal : 10 Gb/s</p></div><div class="ms-network-speed"><span>Limite actuelle</span><strong>10 Mb/s</strong><small>0,1 % du débit nominal</small></div><div class="ms-segment-bar"><i style="transform:scaleX(.01)"></i></div><footer>Le débit est volontairement limité afin d’éviter une surcharge du système.</footer></section>
                <section class="ms-firewall"><h2>Firewall intégré</h2>${checkList(["Vérification des intentions", "Analyse comportementale", "Contrôle d’accès émotionnel", "Inspection profonde des paquets humains"])}<div><span>Niveau de protection</span><strong>RESTRICTION RENFORCÉE</strong></div></section>
            </div>
        </section>`;
}

function processRow(name, state, load) {
    return `<div class="ms-process-row" data-state="${state}"><span><i></i><strong>${name}</strong></span><span>${state === "running" ? "Actif" : "Suspendu"}</span><div><i style="transform:scaleX(${load / 100})"></i></div><strong>${load} %</strong></div>`;
}

function renderProcesses() {
    return `
        <section class="ms-detail-view">
            <header class="ms-view-heading"><div><h1>Processus cognitifs</h1><p>Ordonnancement actuel du Pentium Recovery Edition.</p></div><span class="ms-live-badge"><i></i> 4 essentiels actifs</span></header>
            <div class="ms-process-table"><div class="ms-process-head"><span>Processus</span><span>État</span><span>Charge</span><span>CPU</span></div>${processRow("Travail", "running", 31)}${processRow("Responsabilités", "running", 28)}${processRow("LUMA", "running", 22)}${processRow("Résolution de problèmes", "running", 17)}${processRow("Motivation sportive", "suspended", 0)}${processRow("Social étendu", "suspended", 0)}${processRow("Détente profonde", "suspended", 0)}</div>
        </section>`;
}

function renderDiagnostic() {
    return `
        <section class="ms-detail-view ms-diagnostic">
            <header class="ms-view-heading"><div><h1>Diagnostic système</h1><p>Rapport généré par Matheo Systems Firmware.</p></div><span class="ms-diagnostic-code">MS-ENERGY-008</span></header>
            <div class="ms-diagnostic-result"><span>${icon("check")}</span><div><h2>Le matériel est entièrement fonctionnel</h2><p>Aucun composant n’est considéré comme défectueux.</p></div></div>
            <div class="ms-diagnostic-copy"><p>Le système a détecté que la consommation énergétique dépassait les capacités des batteries principales.</p><p>Le firmware a donc automatiquement basculé sur l’architecture de secours — Socket 2, RAM DDR2 et HDD — afin d’assurer une disponibilité continue.</p></div>
            <div class="ms-diagnostic-performance"><div><span>Performance réduite</span><strong>≈ 8 %</strong><small>des capacités nominales</small></div><div class="ms-segment-bar"><i></i></div></div>
            <div class="ms-recommendation"><span>${icon("activity")}</span><div><h2>Action recommandée</h2><p>Repos complet, recharge prolongée et redémarrage sont recommandés dès que les conditions le permettent.</p></div><button type="button" data-ms-action="reboot">Planifier le redémarrage</button></div>
            <p class="ms-disclaimer">Diagnostic humoristique. Le repos, lui, reste une vraie dépendance système.</p>
        </section>`;
}

const renderers = { overview: renderOverview, cpu: renderCpu, memory: renderMemory, power: renderPower, network: renderNetwork, processes: renderProcesses, diagnostic: renderDiagnostic };

export function mount(root, { toast }) {
    let currentView = "overview";
    root.innerHTML = `
        <!--
        THESIS: MATHEO SYSTEMS transforme un état de fatigue humain en diagnostic matériel crédible, drôle et bienveillant.
        OWN-WORLD: Centre de contrôle LUMA autonome, inspiré des utilitaires CPU sans reproduire une marque ni quitter la DA LUMA Fluent.
        STORY: Le matériel nominal reste intact ; le firmware protège la disponibilité en basculant sur un socket de secours à 8 %.
        FIRST VIEWPORT: Identité Mk.26.8, mode survie, capacité disponible et topologie des deux sockets doivent se lire immédiatement.
        FORM: Surfaces graphite denses, tracés techniques, orange thermique réservé à l’énergie et états compréhensibles sans dépendre de la couleur. Seed key: cognitive-recovery-socket-26-8.
        FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md.
        -->
        <div class="matheo-systems-app">
            <aside class="ms-sidebar">
                <div class="ms-brand"><span>${icon("chip")}<i>MS</i></span><div><strong>MATHEO</strong><small>SYSTEMS</small></div></div>
                <nav aria-label="Sections Matheo Systems">${views.map((view) => `<button type="button" data-ms-view="${view.id}" class="${view.id === currentView ? "is-current" : ""}">${icon(view.icon)}<span>${view.label}</span></button>`).join("")}</nav>
                <div class="ms-firmware"><span>FIRMWARE</span><strong>26.8.0-survival</strong><small>Autopilot Professional</small></div>
            </aside>
            <main class="ms-main">
                <header class="ms-toolbar"><div><span class="ms-toolbar-dot"></span><strong>MATHEO SYSTEMS CONTROL CENTER</strong><small>Workstation Cognitive Mk.26.8</small></div><div><span>MODE</span><strong>SURVIE</strong><button type="button" data-ms-action="reboot">${icon("power")} Redémarrer</button></div></header>
                <div class="ms-content" aria-live="polite"></div>
            </main>
            <dialog class="ms-reboot-dialog"><form method="dialog"><span class="ms-dialog-icon">${icon("power")}</span><h2>Redémarrage différé</h2><p>Le firmware exige une fenêtre de maintenance contenant au minimum :</p>${checkList(["8 heures de sommeil", "Une recharge prolongée", "Aucun ticket critique", "Une activité sans objectif productif"])}<div><button value="cancel">Compris</button><button value="confirm">Simuler quand même</button></div></form></dialog>
        </div>`;

    const content = root.querySelector(".ms-content");
    const dialog = root.querySelector(".ms-reboot-dialog");

    function render() {
        content.innerHTML = renderers[currentView]();
        root.querySelectorAll("[data-ms-view]").forEach((button) => button.classList.toggle("is-current", button.dataset.msView === currentView));
        content.scrollTop = 0;
    }

    const onClick = (event) => {
        const nextView = event.target.closest("[data-ms-view]")?.dataset.msView;
        const action = event.target.closest("[data-ms-action]")?.dataset.msAction;
        if (nextView) { currentView = nextView; render(); }
        else if (action === "reboot") dialog.showModal();
        else if (action === "recharge") toast?.("Recharge initialisée : progression estimée après une vraie pause.");
    };
    const onDialogClose = () => {
        if (dialog.returnValue === "confirm") toast?.("Redémarrage annulé par le contrôleur de bon sens.");
    };

    root.addEventListener("click", onClick);
    dialog.addEventListener("close", onDialogClose);
    render();
    return () => { root.removeEventListener("click", onClick); dialog.removeEventListener("close", onDialogClose); };
}
