const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;

const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "ogg", "oga", "m4a", "aac", "flac", "opus", "weba"]);

function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const total = Math.floor(seconds);
    const minutes = Math.floor(total / 60);
    const remainder = total % 60;
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function fileNameNoExtension(name) {
    const index = name.lastIndexOf(".");
    return index > 0 ? name.slice(0, index) : name;
}

export async function mount(root, { app, options, toast }) {
    const item = options?.data?.document || app.data?.document;
    if (!item) throw new Error("Aucun fichier audio n’a été sélectionné.");

    root.innerHTML = `
        <div class="music-player" data-state="loading">
            <main class="music-player__stage">
                <div class="music-player__artwork" aria-hidden="true">${icon("music")}<i></i></div>
                <div class="music-player__meta">
                    <h2>${escapeHtml(fileNameNoExtension(item.name))}</h2>
                    <p>${escapeHtml(item.name)}</p>
                </div>
                <div class="music-player__timeline">
                    <div class="music-player__track" data-player-seek>
                        <i class="music-player__fill" data-player-fill></i><i class="music-player__knob" data-player-knob></i>
                    </div>
                    <div class="music-player__times"><output data-player-current>0:00</output><output data-player-duration>0:00</output></div>
                </div>
                <div class="music-player__controls">
                    <button type="button" data-player-action="play" aria-label="Lire la piste" aria-pressed="false">${icon("play")}</button>
                </div>
                <div class="music-player__volume" data-player-seek data-volume-bar>
                    ${icon("volume")}<i class="music-player__volume-track"><i class="music-player__volume-fill" data-player-volume-fill></i></i>
                </div>
                <a class="music-player__download" href="/api/documents/${item.id}/download">${icon("download")}<span>Télécharger</span></a>
            </main>
            <audio data-player-audio preload="metadata" hidden></audio>
        </div>`;

    const player = root.querySelector(".music-player");
    const audio = root.querySelector("[data-player-audio]");
    const playButton = root.querySelector('[data-player-action="play"]');
    const playIcon = playButton.querySelector("use");
    const fill = root.querySelector("[data-player-fill]");
    const knob = root.querySelector("[data-player-knob]");
    const currentOutput = root.querySelector("[data-player-current]");
    const durationOutput = root.querySelector("[data-player-duration]");
    const volumeFill = root.querySelector("[data-player-volume-fill]");
    const volumeBar = root.querySelector("[data-volume-bar]");
    let objectUrl;
    let volume = Number(localStorage.getItem("luma.music.volume") || "1");
    volume = Math.min(1, Math.max(0, volume));

    function setVolume(value) {
        volume = Math.min(1, Math.max(0, value));
        audio.volume = volume;
        volumeFill.style.width = `${volume * 100}%`;
        localStorage.setItem("luma.music.volume", String(volume));
    }

    function setPlaying(playing) {
        player.dataset.state = playing ? "playing" : "ready";
        playButton.setAttribute("aria-pressed", String(playing));
        playIcon.setAttribute("href", `#icon-${playing ? "pause" : "play"}`);
    }

    function updateProgress() {
        const ratio = audio.duration ? audio.currentTime / audio.duration : 0;
        fill.style.transform = `scaleX(${Math.min(1, Math.max(0, ratio))})`;
        knob.style.left = `${Math.min(1, Math.max(0, ratio)) * 100}%`;
        currentOutput.textContent = formatTime(audio.currentTime);
        durationOutput.textContent = formatTime(audio.duration);
    }

    function seekFromEvent(event) {
        const bar = event.currentTarget;
        const rect = bar.getBoundingClientRect();
        const ratio = (event.clientX - rect.left) / rect.width;
        const target = audio.duration ? audio.duration * Math.min(1, Math.max(0, ratio)) : 0;
        audio.currentTime = target;
        updateProgress();
    }

    const onClick = (event) => {
        const action = event.target.closest("[data-player-action]")?.dataset.playerAction;
        if (!action) return;
        if (action === "play") {
            if (audio.paused) audio.play();
            else audio.pause();
        }
    };
    const onSeek = (event) => seekFromEvent(event);
    const onVolume = (event) => {
        const bar = event.currentTarget;
        const rect = bar.getBoundingClientRect();
        setVolume((event.clientX - rect.left) / rect.width);
    };

    audio.addEventListener("play", () => setPlaying(true));
    audio.addEventListener("pause", () => setPlaying(false));
    audio.addEventListener("ended", () => { audio.currentTime = 0; setPlaying(false); });
    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("loadedmetadata", () => { updateProgress(); player.dataset.state = "ready"; });
    root.querySelector(".music-player__timeline").addEventListener("click", onSeek);
    volumeBar.addEventListener("click", onVolume);
    root.addEventListener("click", onClick);

    try {
        const response = await fetch(`/api/documents/${item.id}/download`, { credentials: "same-origin" });
        if (!response.ok) throw new Error("Le fichier audio n’a pas pu être chargé.");
        objectUrl = URL.createObjectURL(await response.blob());
        audio.src = objectUrl;
        setVolume(volume);
    } catch (error) {
        const message = error.message || "Le fichier audio n’a pas pu être chargé.";
        player.dataset.state = "error";
        player.querySelector(".music-player__stage").innerHTML = `<div class="music-player__error"><h2>Lecture impossible</h2><p>${escapeHtml(message)}</p></div>`;
        toast?.(message);
    }

    return () => {
        root.removeEventListener("click", onClick);
        root.querySelector(".music-player__timeline")?.removeEventListener("click", onSeek);
        volumeBar.removeEventListener("click", onVolume);
        audio.pause();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
}
