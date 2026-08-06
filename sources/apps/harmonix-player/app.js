/*
 * Le catalogue et les flux publics Sonora passent par /api/harmonix afin de ne partager
 * aucun identifiant Luma OS avec le Core v11. Pour une future instance Harmonix autonome,
 * le pont temps réel reste disponible via BroadcastChannel("harmonix") et les événements
 * DOM harmonix:state / harmonix:command.
 */
const player = document.querySelector("#harmonix-player");
const HARMONIX_ENABLED_KEY = "luma.harmonix.enabled";

if (player) {
    const slot = player.closest(".harmonix-player-slot");
    const taskbarStatus = document.querySelector(".taskbar-status");
    if (slot && taskbarStatus) taskbarStatus.before(slot);

    const elements = {
        title: document.querySelector("#harmonix-title"),
        artist: document.querySelector("#harmonix-artist"),
        marquee: player.querySelector(".harmonix-player__marquee"),
        cover: document.querySelector("#harmonix-cover"),
        heroCover: document.querySelector("#harmonix-hero-cover"),
        heroTitle: document.querySelector("#harmonix-hero-title"),
        heroArtist: document.querySelector("#harmonix-hero-artist"),
        play: document.querySelector("#harmonix-play"),
        playExpanded: document.querySelector("#harmonix-play-expanded"),
        previous: document.querySelector("#harmonix-previous"),
        next: document.querySelector("#harmonix-next"),
        expand: document.querySelector("#harmonix-expand"),
        details: document.querySelector("#harmonix-details"),
        progress: document.querySelector("#harmonix-progress"),
        currentTime: document.querySelector("#harmonix-current-time"),
        duration: document.querySelector("#harmonix-duration"),
        volume: document.querySelector("#harmonix-volume"),
        queue: document.querySelector("#harmonix-queue"),
        queueCount: document.querySelector("#harmonix-queue-count"),
        audio: document.querySelector("#harmonix-audio")
    };

    let state = {
        mode: "local",
        status: "loading",
        connected: false,
        playing: false,
        position: 0,
        duration: 0,
        volume: .8,
        track: null,
        queue: [],
        currentIndex: -1,
        playbackError: false,
        updatedAt: performance.now()
    };
    let catalogController;
    let enabled = localStorage.getItem(HARMONIX_ENABLED_KEY) !== "false";

    const channel = "BroadcastChannel" in window ? new BroadcastChannel("harmonix") : null;

    function text(value, fallback) {
        return typeof value === "string" && value.trim() ? value.trim() : fallback;
    }

    function number(value, fallback = 0) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    function normalizeTrack(track, index = -1) {
        if (!track || typeof track !== "object") return null;
        return {
            id: track.id ?? track.trackId ?? index,
            title: text(track.title ?? track.name, "Titre inconnu"),
            artist: text(track.artist ?? track.author ?? track.albumArtist, "Artiste inconnu"),
            album: text(track.album ?? track.albumName, ""),
            coverUrl: text(track.coverUrl ?? track.cover ?? track.artwork ?? track.poster ?? track.image, ""),
            streamUrl: text(track.streamUrl ?? track.audioUrl ?? track.src, ""),
            duration: Math.max(0, number(track.duration ?? track.durationSeconds)),
            current: Boolean(track.current ?? track.isCurrent)
        };
    }

    function normalizeRemoteState(payload = {}) {
        const candidate = payload.track ?? payload.currentTrack ?? payload.song ?? (payload.title ? payload : null);
        const track = normalizeTrack(candidate);
        const queue = Array.isArray(payload.queue ?? payload.playlist)
            ? (payload.queue ?? payload.playlist).map(normalizeTrack).filter(Boolean)
            : state.queue;
        const currentIndex = number(payload.currentIndex ?? payload.queueIndex, state.currentIndex);
        const duration = Math.max(0, number(payload.duration ?? candidate?.duration, track?.duration ?? state.duration));
        const position = Math.min(duration || Infinity, Math.max(0, number(
            payload.position ?? payload.currentTime ?? payload.elapsed,
            state.position
        )));
        const playing = typeof payload.playing === "boolean"
            ? payload.playing
            : typeof payload.isPlaying === "boolean"
                ? payload.isPlaying
                : typeof payload.paused === "boolean" ? !payload.paused : state.playing;
        const shouldClearTrack = payload.connected === false || payload.track === null || payload.currentTrack === null;

        return {
            mode: "remote",
            status: payload.connected === false ? "error" : "ready",
            connected: typeof payload.connected === "boolean" ? payload.connected : Boolean(track || queue.length),
            playing,
            position,
            duration,
            volume: Math.min(1, Math.max(0, number(payload.volume, state.volume))),
            track: shouldClearTrack ? null : track ?? state.track,
            queue,
            currentIndex,
            playbackError: false,
            updatedAt: performance.now()
        };
    }

    function formatTime(seconds) {
        const safeSeconds = Math.max(0, Math.floor(number(seconds)));
        const minutes = Math.floor(safeSeconds / 60);
        return `${minutes}:${String(safeSeconds % 60).padStart(2, "0")}`;
    }

    function setIcon(button, symbol) {
        button?.querySelector("use")?.setAttribute("href", `#icon-${symbol}`);
    }

    function setCover(image, url) {
        if (!image) return;
        if (!url) {
            image.hidden = true;
            image.removeAttribute("src");
            return;
        }
        image.onload = () => { image.hidden = false; };
        image.onerror = () => {
            image.hidden = true;
            image.removeAttribute("src");
        };
        if (image.src !== new URL(url, window.location.href).href) image.src = url;
    }

    function updateTitleScrolling() {
        if (!elements.title || !elements.marquee) return;
        player.classList.remove("is-scrolling");
        player.style.removeProperty("--marquee-distance");
        requestAnimationFrame(() => {
            const overflow = elements.title.scrollWidth - elements.marquee.clientWidth;
            if (overflow > 4) {
                player.style.setProperty("--marquee-distance", `${-(overflow + 12)}px`);
                player.style.setProperty("--marquee-duration", `${Math.max(7, (overflow + 12) / 24 + 5)}s`);
                player.classList.add("is-scrolling");
            }
        });
    }

    function renderEmptyQueue() {
        const empty = document.createElement("li");
        empty.className = "harmonix-player__empty";

        if (state.status === "loading") {
            empty.textContent = "Connexion au catalogue public Sonora…";
        } else if (state.status === "error") {
            const message = document.createElement("span");
            message.textContent = "Harmonix est indisponible pour le moment.";
            const retry = document.createElement("button");
            retry.type = "button";
            retry.dataset.harmonixRetry = "";
            retry.textContent = "Réessayer";
            empty.append(message, retry);
        } else {
            empty.textContent = "Aucune musique publique n’est disponible.";
        }
        elements.queue.append(empty);
    }

    function renderQueue() {
        elements.queue.replaceChildren();
        elements.queueCount.textContent = `${state.queue.length} titre${state.queue.length > 1 ? "s" : ""}`;
        if (!state.queue.length) {
            renderEmptyQueue();
            return;
        }

        state.queue.forEach((track, index) => {
            const item = document.createElement("li");
            item.className = "harmonix-player__queue-item";
            if (index === state.currentIndex || track.current) item.classList.add("is-current");

            const button = document.createElement("button");
            button.type = "button";
            button.dataset.queueIndex = String(index);
            button.setAttribute("aria-label", `Lire ${track.title} — ${track.artist}`);

            const cover = document.createElement("span");
            cover.className = "harmonix-player__queue-cover";
            if (track.coverUrl) {
                const image = document.createElement("img");
                image.src = track.coverUrl;
                image.alt = "";
                image.loading = "lazy";
                image.addEventListener("error", () => image.remove());
                cover.append(image);
            }
            const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            icon.setAttribute("class", "icon");
            icon.setAttribute("aria-hidden", "true");
            const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
            use.setAttribute("href", "#icon-music");
            icon.append(use);
            cover.append(icon);

            const copy = document.createElement("span");
            copy.className = "harmonix-player__queue-copy";
            const title = document.createElement("strong");
            title.textContent = track.title;
            const artist = document.createElement("span");
            artist.textContent = track.artist;
            copy.append(title, artist);

            const duration = document.createElement("span");
            duration.className = "harmonix-player__queue-duration";
            duration.textContent = track.duration ? formatTime(track.duration) : "";
            button.append(cover, copy, duration);
            item.append(button);
            elements.queue.append(item);
        });
    }

    function effectivePosition() {
        if (state.mode === "local") return number(elements.audio.currentTime, state.position);
        if (!state.playing) return state.position;
        const elapsed = (performance.now() - state.updatedAt) / 1000;
        return Math.min(state.duration || Infinity, state.position + elapsed);
    }

    function renderTimeline() {
        const position = effectivePosition();
        const percentage = state.duration ? Math.min(100, position / state.duration * 100) : 0;
        elements.currentTime.textContent = formatTime(position);
        elements.duration.textContent = formatTime(state.duration);
        if (!elements.progress.matches(":active")) elements.progress.value = String(percentage);
        elements.progress.style.setProperty("--range-progress", `${percentage}%`);
    }

    function statusCopy() {
        if (state.track) {
            return {
                title: state.track.title,
                artist: state.playbackError
                    ? `${state.track.artist} · Lecture indisponible`
                    : state.track.artist
            };
        }
        if (state.status === "loading") {
            return { title: "Connexion à Harmonix…", artist: "Catalogue public Sonora" };
        }
        if (state.status === "error") {
            return { title: "Harmonix indisponible", artist: "Développez pour réessayer" };
        }
        if (state.queue.length) {
            return { title: "Harmonix", artist: `${state.queue.length} titres disponibles` };
        }
        return { title: "Harmonix", artist: "Aucune musique publique" };
    }

    function render() {
        const copy = statusCopy();
        player.dataset.connected = String(state.connected);
        player.dataset.status = state.status;
        elements.title.textContent = copy.title;
        elements.artist.textContent = copy.artist;
        elements.heroTitle.textContent = copy.title;
        elements.heroArtist.textContent = copy.artist;
        setCover(elements.cover, state.track?.coverUrl);
        setCover(elements.heroCover, state.track?.coverUrl);

        const hasQueue = state.connected && state.queue.length > 0;
        const hasTrack = state.connected && Boolean(state.track);
        elements.play.disabled = !hasQueue && !hasTrack;
        elements.playExpanded.disabled = !hasQueue && !hasTrack;
        elements.previous.disabled = !hasTrack || state.queue.length < 2;
        elements.next.disabled = !hasTrack || state.queue.length < 2;
        elements.progress.disabled = !hasTrack;
        elements.volume.disabled = !state.connected;
        [elements.play, elements.playExpanded].forEach((button) => {
            button.setAttribute("aria-label", state.playing ? "Mettre en pause" : "Lire");
            setIcon(button, state.playing ? "pause" : "play");
        });
        elements.volume.value = String(state.volume);
        elements.volume.style.setProperty("--range-progress", `${state.volume * 100}%`);
        renderTimeline();
        renderQueue();
        updateTitleScrolling();
    }

    function updateMediaMetadata(track) {
        if (!("mediaSession" in navigator) || !("MediaMetadata" in window) || !track) return;
        try {
            navigator.mediaSession.metadata = new MediaMetadata({
                title: track.title,
                artist: track.artist,
                album: track.album,
                artwork: track.coverUrl ? [{ src: new URL(track.coverUrl, window.location.href).href }] : []
            });
        } catch {
            // Le lecteur reste fonctionnel si Media Session n'accepte pas les métadonnées.
        }
    }

    async function selectLocalTrack(index, autoplay = true) {
        const safeIndex = Math.max(0, Math.min(state.queue.length - 1, number(index)));
        const track = state.queue[safeIndex];
        if (!track?.streamUrl) return;

        state = {
            ...state,
            mode: "local",
            status: "ready",
            connected: true,
            playing: false,
            position: 0,
            duration: track.duration,
            track,
            currentIndex: safeIndex,
            playbackError: false,
            updatedAt: performance.now()
        };
        elements.audio.src = track.streamUrl;
        elements.audio.volume = state.volume;
        updateMediaMetadata(track);
        render();
        if (autoplay) {
            try {
                await elements.audio.play();
            } catch {
                state.playing = false;
                render();
            }
        }
    }

    function playRelative(offset) {
        if (!state.queue.length) return;
        const origin = state.currentIndex >= 0 ? state.currentIndex : 0;
        const index = (origin + offset + state.queue.length) % state.queue.length;
        selectLocalTrack(index, true);
    }

    function handleLocalCommand(action, value) {
        if (state.mode !== "local") return;
        if (action === "toggle-playback") {
            if (!state.track) selectLocalTrack(state.currentIndex >= 0 ? state.currentIndex : 0, true);
            else if (elements.audio.paused) elements.audio.play().catch(() => {});
            else elements.audio.pause();
        } else if (action === "play") {
            if (!state.track) selectLocalTrack(0, true);
            else elements.audio.play().catch(() => {});
        } else if (action === "pause") {
            elements.audio.pause();
        } else if (action === "previous") {
            playRelative(-1);
        } else if (action === "next") {
            playRelative(1);
        } else if (action === "seek" && state.track) {
            elements.audio.currentTime = Math.max(0, Math.min(state.duration, number(value)));
        } else if (action === "set-volume") {
            elements.audio.volume = Math.min(1, Math.max(0, number(value, state.volume)));
        } else if (action === "play-queue-item") {
            selectLocalTrack(number(value), true);
        }
    }

    function sendCommand(action, value) {
        handleLocalCommand(action, value);
        const detail = { action, value };
        window.dispatchEvent(new CustomEvent("harmonix:command", { detail }));
        channel?.postMessage({ source: "luma-os", type: "command", ...detail });
        for (let index = 0; index < window.frames.length; index += 1) {
            window.frames[index].postMessage(
                { source: "luma-os", type: "harmonix:command", ...detail },
                window.location.origin
            );
        }
    }

    function setRemoteState(payload) {
        elements.audio.pause();
        elements.audio.removeAttribute("src");
        state = normalizeRemoteState(payload);
        render();
    }

    async function loadPublicCatalog() {
        catalogController?.abort();
        catalogController = new AbortController();
        const timeout = window.setTimeout(() => catalogController.abort(), 10000);
        elements.audio.pause();
        elements.audio.removeAttribute("src");
        elements.audio.load();
        state = {
            ...state,
            mode: "local",
            status: "loading",
            connected: false,
            playing: false,
            position: 0,
            duration: 0,
            track: null,
            queue: [],
            currentIndex: -1,
            playbackError: false
        };
        render();
        try {
            const response = await fetch("/api/harmonix/tracks", {
                headers: { accept: "application/json" },
                signal: catalogController.signal
            });
            if (!response.ok) throw new Error(`Harmonix ${response.status}`);
            const payload = await response.json();
            const rows = payload?.data?.tracks ?? payload?.tracks ?? payload;
            const queue = Array.isArray(rows) ? rows.map(normalizeTrack).filter(Boolean) : [];
            const firstTrack = queue[0] ?? null;
            state = {
                ...state,
                status: queue.length ? "ready" : "empty",
                connected: true,
                queue,
                track: firstTrack,
                currentIndex: firstTrack ? 0 : -1,
                duration: firstTrack?.duration ?? 0,
                updatedAt: performance.now()
            };
            if (firstTrack?.streamUrl) {
                elements.audio.src = firstTrack.streamUrl;
                elements.audio.volume = state.volume;
                updateMediaMetadata(firstTrack);
            }
        } catch (error) {
            if (error?.name !== "AbortError" || !catalogController.signal.aborted) {
                console.warn("[Luma OS][Harmonix] Catalogue indisponible :", error);
            }
            state = { ...state, status: "error", connected: false, queue: [] };
        } finally {
            window.clearTimeout(timeout);
            render();
        }
    }

    function setExpanded(expanded) {
        player.dataset.expanded = String(expanded);
        elements.details.hidden = !expanded;
        elements.expand.setAttribute("aria-expanded", String(expanded));
        elements.expand.setAttribute("aria-label", expanded ? "Réduire le lecteur" : "Développer le lecteur");
        setIcon(elements.expand, expanded ? "collapse" : "expand");
        updateTitleScrolling();
    }

    function setEnabled(nextEnabled, { persist = true } = {}) {
        enabled = Boolean(nextEnabled);
        if (persist) localStorage.setItem(HARMONIX_ENABLED_KEY, String(enabled));
        player.dataset.enabled = String(enabled);
        slot.hidden = !enabled;
        slot.setAttribute("aria-hidden", String(!enabled));
        if (enabled) {
            loadPublicCatalog();
            return;
        }
        catalogController?.abort();
        elements.audio.pause();
        elements.audio.removeAttribute("src");
        elements.audio.load();
        setExpanded(false);
    }

    elements.expand.addEventListener("click", () => setExpanded(player.dataset.expanded !== "true"));
    elements.play.addEventListener("click", () => sendCommand("toggle-playback"));
    elements.playExpanded.addEventListener("click", () => sendCommand("toggle-playback"));
    elements.previous.addEventListener("click", () => sendCommand("previous"));
    elements.next.addEventListener("click", () => sendCommand("next"));
    elements.progress.addEventListener("input", () => {
        elements.progress.style.setProperty("--range-progress", `${elements.progress.value}%`);
        elements.currentTime.textContent = formatTime(state.duration * number(elements.progress.value) / 100);
    });
    elements.progress.addEventListener("change", () => {
        sendCommand("seek", state.duration * number(elements.progress.value) / 100);
    });
    elements.volume.addEventListener("input", () => {
        elements.volume.style.setProperty("--range-progress", `${number(elements.volume.value) * 100}%`);
        sendCommand("set-volume", number(elements.volume.value));
    });
    elements.queue.addEventListener("click", (event) => {
        const retry = event.target.closest("[data-harmonix-retry]");
        if (retry) {
            loadPublicCatalog();
            return;
        }
        const button = event.target.closest("[data-queue-index]");
        if (button) sendCommand("play-queue-item", number(button.dataset.queueIndex));
    });

    elements.audio.addEventListener("play", () => {
        state.playing = true;
        state.playbackError = false;
        state.updatedAt = performance.now();
        render();
    });
    elements.audio.addEventListener("pause", () => {
        state.playing = false;
        state.position = number(elements.audio.currentTime, state.position);
        state.updatedAt = performance.now();
        render();
    });
    elements.audio.addEventListener("timeupdate", () => {
        state.position = number(elements.audio.currentTime, state.position);
        renderTimeline();
    });
    elements.audio.addEventListener("durationchange", () => {
        state.duration = number(elements.audio.duration, state.track?.duration ?? state.duration);
        renderTimeline();
    });
    elements.audio.addEventListener("volumechange", () => {
        state.volume = elements.audio.volume;
        elements.volume.value = String(state.volume);
        elements.volume.style.setProperty("--range-progress", `${state.volume * 100}%`);
    });
    elements.audio.addEventListener("ended", () => playRelative(1));
    elements.audio.addEventListener("error", () => {
        if (!elements.audio.currentSrc) return;
        state.playing = false;
        state.playbackError = true;
        render();
    });

    window.addEventListener("harmonix:state", (event) => setRemoteState(event.detail));
    window.addEventListener("message", (event) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === "harmonix:state" || (event.data?.source === "harmonix" && event.data?.type === "state")) {
            setRemoteState(event.data.payload ?? event.data.state ?? event.data);
        }
    });
    channel?.addEventListener("message", (event) => {
        if (event.data?.source !== "harmonix" || event.data?.type !== "state") return;
        setRemoteState(event.data.payload ?? event.data.state ?? event.data);
    });
    window.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && player.dataset.expanded === "true") setExpanded(false);
    });
    window.addEventListener("resize", updateTitleScrolling);
    window.addEventListener("luma:harmonix-enabled", (event) => setEnabled(event.detail?.enabled));

    if ("mediaSession" in navigator) {
        try {
            navigator.mediaSession.setActionHandler("play", () => sendCommand("play"));
            navigator.mediaSession.setActionHandler("pause", () => sendCommand("pause"));
            navigator.mediaSession.setActionHandler("previoustrack", () => sendCommand("previous"));
            navigator.mediaSession.setActionHandler("nexttrack", () => sendCommand("next"));
        } catch {
            // Certains navigateurs exposent Media Session sans prendre en charge toutes les actions.
        }
    }

    window.HarmonixPlayer = Object.freeze({
        setState: setRemoteState,
        reload: loadPublicCatalog,
        collapse: () => setExpanded(false),
        setEnabled,
        isEnabled: () => enabled
    });
    channel?.postMessage({ source: "luma-os", type: "request-state" });
    window.setInterval(renderTimeline, 1000);
    setEnabled(enabled, { persist: false });
}
