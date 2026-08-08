const PRESETS = [
    { id: "pomodoro", label: "Pomodoro", seconds: 25 * 60, tone: "#e257b0" },
    { id: "pause", label: "Pause courte", seconds: 5 * 60, tone: "#56c98f" },
    { id: "pause-longue", label: "Pause longue", seconds: 15 * 60, tone: "#5aa2f0" }
];

function pad(number) {
    return String(number).padStart(2, "0");
}

function formatSeconds(totalSeconds) {
    const seconds = Math.max(0, Math.round(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const rest = seconds % 60;
    if (hours > 0) return `${hours}:${pad(minutes)}:${pad(rest)}`;
    return `${pad(minutes)}:${pad(rest)}`;
}

function formatStopwatch(totalMilliseconds) {
    const total = Math.floor(totalMilliseconds / 10);
    const hours = Math.floor(total / 360000);
    const minutes = Math.floor((total % 360000) / 6000);
    const seconds = Math.floor((total % 6000) / 100);
    const hundredths = total % 100;
    if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}:${pad(hundredths)}`;
    return `${pad(minutes)}:${pad(seconds)}:${pad(hundredths)}`;
}

export function mount(root, context = {}) {
    const { toast = () => {} } = context;

    let mode = "timer";
    let selectedPreset = PRESETS[0].id;
    let remaining = PRESETS[0].seconds;
    let running = false;
    let timerInterval = null;
    let stopwatchMilliseconds = 0;
    let stopwatchStartedAt = null;
    let laps = [];

    root.innerHTML = `
        <div class="timer-app">
            <header class="timer-header">
                <div><h1>Minuteur</h1><p>Minuteur · chronomètre · rappels</p></div>
            </header>
            <div class="timer-tabs" role="tablist" aria-label="Mode">
                <button type="button" class="timer-tab is-active" data-timer-tab="timer" role="tab" aria-selected="true">Minuteur</button>
                <button type="button" class="timer-tab" data-timer-tab="stopwatch" role="tab" aria-selected="false">Chronomètre</button>
            </div>
            <div class="timer-body">
                <section class="timer-panel" data-timer-panel="timer">
                    <div class="timer-presets" role="group" aria-label="Présélections">
                        ${PRESETS.map((preset) => `
                            <button type="button" class="timer-preset${preset.id === selectedPreset ? " is-active" : ""}" data-timer-preset="${preset.id}">
                                <span class="timer-preset__dot" style="--preset-tone: ${preset.tone}"></span>
                                ${preset.label}
                            </button>`).join("")}
                    </div>
                    <output class="timer-display" data-timer-display aria-live="off">${formatSeconds(remaining)}</output>
                    <div class="timer-controls">
                        <button type="button" class="timer-btn timer-btn--primary" data-timer-toggle>Démarrer</button>
                        <button type="button" class="timer-btn" data-timer-reset>Réinitialiser</button>
                    </div>
                </section>
                <section class="timer-panel" data-timer-panel="stopwatch" hidden>
                    <output class="timer-display timer-display--stopwatch" data-stopwatch-display aria-live="off">00:00:00</output>
                    <div class="timer-controls">
                        <button type="button" class="timer-btn timer-btn--primary" data-stopwatch-toggle>Démarrer</button>
                        <button type="button" class="timer-btn" data-stopwatch-lap>Tour</button>
                        <button type="button" class="timer-btn" data-stopwatch-reset>Réinitialiser</button>
                    </div>
                    <ol class="timer-laps" data-stopwatch-laps></ol>
                </section>
            </div>
        </div>`;

    const display = root.querySelector("[data-timer-display]");
    const stopwatchDisplay = root.querySelector("[data-stopwatch-display]");
    const lapsList = root.querySelector("[data-stopwatch-laps]");
    const tabs = root.querySelectorAll("[data-timer-tab]");
    const panels = root.querySelectorAll("[data-timer-panel]");
    const presets = root.querySelectorAll("[data-timer-preset]");
    const toggleButton = root.querySelector("[data-timer-toggle]");
    const stopwatchToggle = root.querySelector("[data-stopwatch-toggle]");

    function notify(title, message) {
        toast(message);
        if (title in document.title || document.title.includes(title)) return;
        const previous = document.title;
        document.title = `${title} — ${message}`;
        window.setTimeout(() => { document.title = previous; }, 4000);
    }

    function playSound() {
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;
            const audioContext = new AudioContextClass();
            const gain = audioContext.createGain();
            gain.connect(audioContext.destination);
            [0, 0.35, 0.7].forEach((offset) => {
                const oscillator = audioContext.createOscillator();
                const envelope = audioContext.createGain();
                oscillator.type = "sine";
                oscillator.frequency.value = offset === 0 ? 880 : offset === 0.35 ? 1100 : 880;
                envelope.gain.setValueAtTime(0.0001, audioContext.currentTime + offset);
                envelope.gain.exponentialRampToValueAtTime(0.4, audioContext.currentTime + offset + 0.02);
                envelope.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + offset + 0.3);
                oscillator.connect(envelope);
                envelope.connect(gain);
                oscillator.start(audioContext.currentTime + offset);
                oscillator.stop(audioContext.currentTime + offset + 0.32);
            });
            window.setTimeout(() => audioContext.close(), 1500);
        } catch { /* son indisponible : ignoré */ }
    }

    function stopTimer() {
        running = false;
        if (timerInterval) window.clearInterval(timerInterval);
        timerInterval = null;
        toggleButton.textContent = "Démarrer";
    }

    function startTimer() {
        if (running) return;
        running = true;
        toggleButton.textContent = "Pause";
        timerInterval = window.setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
                remaining = 0;
                display.textContent = formatSeconds(0);
                stopTimer();
                const preset = PRESETS.find((item) => item.id === selectedPreset);
                notify("Minuteur terminé", `Le minuteur « ${preset.label} » est terminé.`);
                playSound();
                return;
            }
            display.textContent = formatSeconds(remaining);
        }, 1000);
    }

    function setPreset(id) {
        selectedPreset = id;
        remaining = PRESETS.find((item) => item.id === id).seconds;
        stopTimer();
        presets.forEach((button) => button.classList.toggle("is-active", button.dataset.timerPreset === id));
        display.textContent = formatSeconds(remaining);
    }

    function setMode(nextMode) {
        mode = nextMode;
        stopTimer();
        tabs.forEach((tab) => tab.classList.toggle("is-active", tab.dataset.timerTab === nextMode));
        tabs.forEach((tab) => tab.setAttribute("aria-selected", tab.dataset.timerTab === nextMode ? "true" : "false"));
        panels.forEach((panel) => { panel.hidden = panel.dataset.timerPanel !== nextMode; });
    }

    function renderStopwatch() {
        if (stopwatchStartedAt !== null) {
            stopwatchMilliseconds = Date.now() - stopwatchStartedAt;
        }
        stopwatchDisplay.textContent = formatStopwatch(stopwatchMilliseconds);
    }

    function stopStopwatch() {
        if (stopwatchStartedAt === null) return;
        stopwatchStartedAt = null;
        stopwatchToggle.textContent = "Démarrer";
        if (timerInterval) window.clearInterval(timerInterval);
        timerInterval = null;
    }

    function startStopwatch() {
        if (stopwatchStartedAt !== null) return;
        stopwatchStartedAt = Date.now() - stopwatchMilliseconds;
        stopwatchToggle.textContent = "Pause";
        timerInterval = window.setInterval(renderStopwatch, 10);
    }

    function renderLaps() {
        lapsList.innerHTML = laps.map((lap, index) => `
            <li class="timer-lap">
                <span class="timer-lap__label">Tour ${laps.length - index}</span>
                <span class="timer-lap__time">${lap}</span>
            </li>`).join("");
    }

    root.addEventListener("click", (event) => {
        const presetButton = event.target.closest("[data-timer-preset]");
        if (presetButton) { setPreset(presetButton.dataset.timerPreset); return; }
        const tab = event.target.closest("[data-timer-tab]");
        if (tab) { setMode(tab.dataset.timerTab); return; }
        if (event.target.closest("[data-timer-toggle]")) {
            if (mode !== "timer") setMode("timer");
            if (running) stopTimer(); else startTimer();
            return;
        }
        if (event.target.closest("[data-timer-reset]")) {
            setPreset(selectedPreset);
            return;
        }
        if (event.target.closest("[data-stopwatch-toggle]")) {
            if (mode !== "stopwatch") setMode("stopwatch");
            if (stopwatchStartedAt !== null) stopStopwatch(); else startStopwatch();
            return;
        }
        if (event.target.closest("[data-stopwatch-lap]")) {
            if (stopwatchStartedAt === null) return;
            renderStopwatch();
            laps.unshift(formatStopwatch(stopwatchMilliseconds));
            renderLaps();
            return;
        }
        if (event.target.closest("[data-stopwatch-reset]")) {
            stopStopwatch();
            stopwatchMilliseconds = 0;
            laps = [];
            renderStopwatch();
            renderLaps();
            return;
        }
    });

    renderStopwatch();

    return () => {
        stopTimer();
        stopStopwatch();
        if (timerInterval) window.clearInterval(timerInterval);
    };
}
