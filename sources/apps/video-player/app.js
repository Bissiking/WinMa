const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;

function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const total = Math.floor(seconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const remainder = total % 60;
    const minute = hours ? String(minutes).padStart(2, "0") : String(minutes);
    return `${hours ? `${hours}:` : ""}${minute}:${String(remainder).padStart(2, "0")}`;
}

function fileNameNoExtension(name) {
    const index = name.lastIndexOf(".");
    return index > 0 ? name.slice(0, index) : name;
}

export async function mount(root, { app, options, toast }) {
    const item = options?.data?.document || app.data?.document;
    if (!item) throw new Error("Aucune vidéo n’a été sélectionnée.");

    root.innerHTML = `
        <div class="video-player" data-state="loading">
            <main class="video-player__stage">
                <div class="video-player__viewport" data-player-viewport>
                    <div class="video-player__placeholder" aria-hidden="true">${icon("video")}</div>
                    <video data-player-video preload="metadata" controls playsinline></video>
                    <button type="button" class="video-player__bigplay" data-player-action="play" aria-label="Lire la vidéo">${icon("play")}</button>
                </div>
                <div class="video-player__bar">
                    <div class="video-player__track" data-player-seek>
                        <i class="video-player__fill" data-player-fill></i><i class="video-player__knob" data-player-knob></i>
                    </div>
                    <div class="video-player__row">
                        <div class="video-player__meta">
                            <h2>${escapeHtml(fileNameNoExtension(item.name))}</h2>
                            <p>${escapeHtml(item.name)}</p>
                        </div>
                        <div class="video-player__controls">
                            <button type="button" data-player-action="play" aria-label="Lecture / pause" aria-pressed="false">${icon("play")}</button>
                            <div class="video-player__volume" data-player-seek data-volume-bar>
                                ${icon("volume")}<i class="video-player__volume-track"><i class="video-player__volume-fill" data-player-volume-fill></i></i>
                            </div>
                            <output class="video-player__times" data-player-current>0:00</output>
                            <span class="video-player__times-sep">/</span>
                            <output class="video-player__times" data-player-duration>0:00</output>
                            <a class="video-player__download" href="/api/documents/${item.id}/download" title="Télécharger">${icon("download")}<span class="sr-only">Télécharger</span></a>
                        </div>
                    </div>
                </div>
            </main>
        </div>`;

    const player = root.querySelector(".video-player");
    const video = root.querySelector("[data-player-video]");
    const playButton = root.querySelector('[data-player-action="play"]');
    const bigPlay = root.querySelector(".video-player__bigplay");
    const playIcons = [playButton.querySelector("use"), bigPlay.querySelector("use")];
    const fill = root.querySelector("[data-player-fill]");
    const knob = root.querySelector("[data-player-knob]");
    const currentOutput = root.querySelector("[data-player-current]");
    const durationOutput = root.querySelector("[data-player-duration]");
    const volumeFill = root.querySelector("[data-player-volume-fill]");
    const volumeBar = root.querySelector("[data-volume-bar]");
    const viewport = root.querySelector("[data-player-viewport]");
    let objectUrl;
    let volume = Number(localStorage.getItem("luma.music.volume") || "1");
    volume = Math.min(1, Math.max(0, volume));

    function setVolume(value) {
        volume = Math.min(1, Math.max(0, value));
        video.volume = volume;
        volumeFill.style.width = `${volume * 100}%`;
        localStorage.setItem("luma.music.volume", String(volume));
    }

    function setPlaying(playing) {
        player.dataset.state = playing ? "playing" : "ready";
        playButton.setAttribute("aria-pressed", String(playing));
        bigPlay.hidden = playing;
        playIcons.forEach((use) => use.setAttribute("href", `#icon-${playing ? "pause" : "play"}`));
    }

    function updateProgress() {
        const ratio = video.duration ? video.currentTime / video.duration : 0;
        fill.style.transform = `scaleX(${Math.min(1, Math.max(0, ratio))})`;
        knob.style.left = `${Math.min(1, Math.max(0, ratio)) * 100}%`;
        currentOutput.textContent = formatTime(video.currentTime);
        durationOutput.textContent = formatTime(video.duration);
    }

    function seekFromEvent(event) {
        const bar = event.currentTarget;
        const rect = bar.getBoundingClientRect();
        const ratio = (event.clientX - rect.left) / rect.width;
        const target = video.duration ? video.duration * Math.min(1, Math.max(0, ratio)) : 0;
        video.currentTime = target;
        updateProgress();
    }

    const onClick = (event) => {
        const action = event.target.closest("[data-player-action]")?.dataset.playerAction;
        if (!action) return;
        if (action === "play") {
            if (video.paused) video.play();
            else video.pause();
        }
    };
    const onViewportClick = (event) => {
        if (event.target.closest("a")) return;
        if (video.paused) video.play();
        else video.pause();
    };
    const onSeek = (event) => seekFromEvent(event);
    const onVolume = (event) => {
        const bar = event.currentTarget;
        const rect = bar.getBoundingClientRect();
        setVolume((event.clientX - rect.left) / rect.width);
    };

    video.addEventListener("play", () => setPlaying(true));
    video.addEventListener("pause", () => setPlaying(false));
    video.addEventListener("ended", () => { setPlaying(false); video.currentTime = 0; });
    video.addEventListener("timeupdate", updateProgress);
    video.addEventListener("loadedmetadata", () => { updateProgress(); player.dataset.state = "ready"; });
    root.querySelector(".video-player__track").addEventListener("click", onSeek);
    volumeBar.addEventListener("click", onVolume);
    root.addEventListener("click", onClick);
    viewport.addEventListener("click", onViewportClick);

    try {
        const response = await fetch(`/api/documents/${item.id}/download`, { credentials: "same-origin" });
        if (!response.ok) throw new Error("La vidéo n’a pas pu être chargée.");
        objectUrl = URL.createObjectURL(await response.blob());
        video.src = objectUrl;
        setVolume(volume);
    } catch (error) {
        const message = error.message || "La vidéo n’a pas pu être chargée.";
        player.dataset.state = "error";
        viewport.innerHTML = `<div class="video-player__error"><h2>Lecture impossible</h2><p>${escapeHtml(message)}</p></div>`;
        toast?.(message);
    }

    return () => {
        root.removeEventListener("click", onClick);
        root.querySelector(".video-player__track")?.removeEventListener("click", onSeek);
        volumeBar.removeEventListener("click", onVolume);
        viewport.removeEventListener("click", onViewportClick);
        video.pause();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
}
