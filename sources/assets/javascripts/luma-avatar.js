// sources/assets/javascripts/luma-avatar.js
const AVATAR_ENDPOINT = "/api/users/me/avatar";

export function avatarInitial(name) {
    return String(name ?? "").trim().charAt(0).toLocaleUpperCase("fr") || "L";
}

// Markup d'un avatar : image Kyros avec repli sémantique sur l'initiale.
export function avatarMarkup(avatarUrl, displayName, { className = "", id = "" } = {}) {
    const initial = avatarInitial(displayName);
    const classes = className ? ` ${className}` : "";
    const idAttribute = id ? ` id="${id}"` : "";
    if (!avatarUrl) {
        return `<span${idAttribute} class="avatar-initial${classes}" aria-hidden="true">${initial}</span>`;
    }
    return `<img${idAttribute} class="avatar-image${classes}" data-luma-avatar data-initial="${initial}" src="${AVATAR_ENDPOINT}" alt="">`;
}

// branche le repli initiale sur chaque <img data-luma-avatar> du conteneur donné.
export function hydrateAvatars(root = document) {
    root.querySelectorAll("img[data-luma-avatar]").forEach((image) => {
        if (image.dataset.hydrated) return;
        image.dataset.hydrated = "true";
        image.addEventListener("error", () => {
            const fallback = document.createElement("span");
            fallback.className = image.className.replace("avatar-image", "avatar-initial");
            fallback.setAttribute("aria-hidden", "true");
            fallback.textContent = image.dataset.initial || "L";
            image.replaceWith(fallback);
        }, { once: true });
    });
}
