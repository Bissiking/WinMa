// sources/assets/javascripts/luma-avatar.js
import { getAvatarOwner, readAvatar, writeAvatar } from "./luma-avatar-store.js";

const AVATAR_ENDPOINT = "/api/users/me/avatar";
const networkRefresh = new Map();

export function avatarInitial(name) {
    return String(name ?? "").trim().charAt(0).toLocaleUpperCase("fr") || "L";
}

// Markup d'un avatar : image Kyros avec repli sémantique sur l'initiale.
// Aucun `src` n'est émis : la résolution est asynchrone, pour servir d'abord la
// copie locale (hors ligne) puis rafraîchir depuis le réseau. Une session sans
// compte actif ne déclenche donc jamais d'appel — et donc jamais de 401.
export function avatarMarkup(avatarUrl, displayName, { className = "", id = "" } = {}) {
    const initial = avatarInitial(displayName);
    const classes = className ? ` ${className}` : "";
    const idAttribute = id ? ` id="${id}"` : "";
    if (!avatarUrl) {
        return `<span${idAttribute} class="avatar-initial${classes}" aria-hidden="true">${initial}</span>`;
    }
    const owner = getAvatarOwner() || "";
    return `<img${idAttribute} class="avatar-image${classes}" data-luma-avatar data-avatar-user="${owner}" data-initial="${initial}" alt="">`;
}

function toInitial(image) {
    const fallback = document.createElement("span");
    fallback.className = image.className.replace("avatar-image", "avatar-initial");
    fallback.setAttribute("aria-hidden", "true");
    fallback.textContent = image.dataset.initial || "L";
    image.replaceWith(fallback);
}

function assignBlob(image, blob) {
    if (!image.isConnected || !blob) return;
    const previous = image.dataset.objectUrl;
    const objectUrl = URL.createObjectURL(blob);
    image.dataset.objectUrl = objectUrl;
    image.src = objectUrl;
    if (previous) URL.revokeObjectURL(previous);
}

function refreshFromNetwork(userId) {
    if (networkRefresh.has(userId)) return networkRefresh.get(userId);
    const pending = fetch(AVATAR_ENDPOINT, { credentials: "same-origin", headers: { accept: "image/*" } })
        .then(async (response) => {
            if (!response.ok) return null;
            const type = response.headers.get("content-type") || "";
            if (!type.startsWith("image/")) return null;
            const blob = await response.blob();
            await writeAvatar(userId, blob);
            return blob;
        })
        .catch(() => null)
        .finally(() => networkRefresh.delete(userId));
    networkRefresh.set(userId, pending);
    return pending;
}

// branche le repli initiale sur chaque <img data-luma-avatar> du conteneur donné.
export function hydrateAvatars(root = document) {
    root.querySelectorAll("img[data-luma-avatar]").forEach((image) => {
        if (image.dataset.hydrated) return;
        image.dataset.hydrated = "true";
        const userId = image.dataset.avatarUser;

        image.addEventListener("error", () => {
            if (image.dataset.objectUrl) URL.revokeObjectURL(image.dataset.objectUrl);
            toInitial(image);
        }, { once: true });

        if (!userId) {
            toInitial(image);
            return;
        }

        // 1. copie locale d'abord : instantanée et disponible hors ligne.
        // 2. puis rafraîchissement réseau, silencieux en cas d'échec.
        readAvatar(userId)
            .then((cached) => {
                if (cached) assignBlob(image, cached);
                return refreshFromNetwork(userId);
            })
            .then((blob) => {
                if (!image.isConnected) return;
                if (blob) assignBlob(image, blob);
                else if (!image.dataset.objectUrl) toInitial(image);
            });
    });
}
