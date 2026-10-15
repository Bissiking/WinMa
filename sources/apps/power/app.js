const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;

function pad(number) {
    return String(number).padStart(2, "0");
}

function formatDuration(seconds) {
    if (seconds === null || seconds === undefined || !Number.isFinite(seconds) || seconds < 0) return "—";
    const total = Math.round(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (hours > 0) return `${hours} h ${pad(minutes)}`;
    return `${minutes} min`;
}

function percentLabel(level) {
    return `${Math.round(level * 100)} %`;
}

export function mount(root, context = {}) {
    const { toast = () => {} } = context;

    let battery = null;
    let available = true;
    let interval = null;

    function render() {
        if (!battery) return;
        const level = percentLabel(battery.level);
        const charging = battery.charging;
        const time = charging ? formatDuration(battery.chargingTime) : formatDuration(battery.dischargingTime);
        const state = charging ? "en charge" : battery.level <= 0.2 ? "faible" : "sur batterie";
        const segments = 10;
        const filled = Math.max(0, Math.min(segments, Math.round(battery.level * segments)));

        let gauge = '<div class="power-bar"><div class="power-bar__track">';
        for (let i = 0; i < segments; i += 1) {
            gauge += `<span class="power-bar__segment${i < filled ? " is-filled" : ""}"></span>`;
        }
        gauge += "</div></div>";

        root.innerHTML = `
            <div class="power-app">
                <header class="power-header">
                    <div><h1>Alimentation</h1><p>Batterie · ${state}</p></div>
                </header>
                <div class="power-hero">
                    <span class="power-hero__icon">${icon("power")}</span>
                    <output class="power-hero__level" aria-live="polite">${level}</output>
                    <p class="power-hero__state">${state}</p>
                </div>
                ${gauge}
                <div class="power-grid" role="list">
                    <div class="power-card" role="listitem">
                        <span class="power-card__label">État</span>
                        <span class="power-card__value">${charging ? "En charge" : battery.level <= 0.2 ? "Niveau faible" : "Décharge"}</span>
                    </div>
                    <div class="power-card" role="listitem">
                        <span class="power-card__label">Temps restant</span>
                        <span class="power-card__value">${time}</span>
                    </div>
                    <div class="power-card" role="listitem">
                        <span class="power-card__label">Niveau</span>
                        <span class="power-card__value">${level}</span>
                    </div>
                    <div class="power-card" role="listitem">
                        <span class="power-card__label">Capacité estimée</span>
                        <span class="power-card__value">${battery.charging ? "—" : "Standard"}</span>
                    </div>
                </div>
                <p class="power-foot">${charging ? "L’alimentation est branchée." : battery.level <= 0.2 ? "Branchez l’alimentation pour continuer." : "Batterie à un niveau confortable."}</p>
            </div>`;
    }

    function applyStatus(manager) {
        const wasCharging = battery?.charging;
        const wasLow = battery ? battery.level <= 0.2 : false;
        battery = manager;
        render();
        if (wasCharging !== undefined && manager.charging !== wasCharging) {
            toast(manager.charging ? "Alimentation branchée — la batterie se recharge." : "Alimentation débranchée — la batterie se décharge.");
        }
        if (!manager.charging && manager.level <= 0.2 && !wasLow) {
            toast("Niveau de batterie faible : 20 % ou moins.");
        }
    }

    function onLevelChange() { if (battery) applyStatus(battery); }
    function onChargingChange() { if (battery) applyStatus(battery); }

    async function start() {
        if (!("getBattery" in navigator)) {
            available = false;
            battery = null;
            root.innerHTML = `
                <div class="power-app">
                    <header class="power-header">
                        <div><h1>Alimentation</h1><p>Batterie</p></div>
                    </header>
                    <div class="power-unavailable">
                        <span class="power-unavailable__icon">${icon("power")}</span>
                        <h2>Battery API indisponible</h2>
                        <p>Votre navigateur n’expose pas l’état de la batterie. Ouvrez Luma OS dans Chrome ou Edge pour consulter l’alimentation en temps réel.</p>
                    </div>
                </div>`;
            return;
        }
        const manager = await navigator.getBattery();
        applyStatus(manager);
        manager.addEventListener("levelchange", onLevelChange);
        manager.addEventListener("chargingchange", onChargingChange);
        manager.addEventListener("chargingtimechange", render);
        manager.addEventListener("dischargingtimechange", render);
        interval = window.setInterval(render, 30000);
    }

    start();

    return () => {
        if (interval) window.clearInterval(interval);
        if (battery) {
            battery.removeEventListener?.("levelchange", onLevelChange);
            battery.removeEventListener?.("chargingchange", onChargingChange);
            battery.removeEventListener?.("chargingtimechange", render);
            battery.removeEventListener?.("dischargingtimechange", render);
        }
    };
}
