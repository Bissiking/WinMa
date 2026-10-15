// sources/assets/javascripts/luma-avatar-store.js
// Copie locale des avatars : bytes personnels rangés dans un Cache Storage dédié,
// jamais dans le cache partagé du Service Worker et jamais servis par le réseau
// depuis ce cache. Purgé à la déconnexion et lors d'un changement de compte.

const CACHE_NAME = "luma-avatar-v1";
const OWNER_KEY = "luma.avatar.owner";

let owner = readOwner();

function readOwner() {
    try { return localStorage.getItem(OWNER_KEY) || null; } catch { return null; }
}

function writeOwner(value) {
    try {
        if (value) localStorage.setItem(OWNER_KEY, value);
        else localStorage.removeItem(OWNER_KEY);
    } catch { /* stockage indisponible */ }
}

function avatarRequest(userId) {
    // Clé synthétique : aucun chemin réel ne pointe ici, le Service Worker ne
    // peut donc jamais servir ces bytes à la place de l'API.
    return new Request(`/__luma_avatar__/${encodeURIComponent(userId)}`);
}

function hasCacheStorage() {
    return typeof window !== "undefined" && "caches" in window;
}

export function getAvatarOwner() {
    return owner;
}

// Appelé au chargement de la session : purge le cache si le compte change.
export function setAvatarOwner(userId) {
    const next = userId || null;
    if (next === owner) return;
    owner = next;
    writeOwner(next);
    clearAvatarCache();
}

export async function readAvatar(userId) {
    if (!userId || !hasCacheStorage()) return null;
    try {
        const cache = await caches.open(CACHE_NAME);
        const response = await cache.match(avatarRequest(userId));
        return response ? await response.blob() : null;
    } catch { return null; }
}

// N'accepte que des réponses 200 de type image : un 401 ou un 404 ne peut
// jamais s'inscrire dans le cache et fausser la lecture suivante.
export async function writeAvatar(userId, blob) {
    if (!userId || !blob) return false;
    if (!blob.type || !blob.type.startsWith("image/")) return false;
    if (!hasCacheStorage()) return false;
    try {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(avatarRequest(userId), new Response(blob, {
            headers: { "Content-Type": blob.type, "Content-Length": String(blob.size) }
        }));
        return true;
    } catch { return false; }
}

export async function clearAvatarCache() {
    if (!hasCacheStorage()) return;
    try { await caches.delete(CACHE_NAME); } catch { /* purge best-effort */ }
}
