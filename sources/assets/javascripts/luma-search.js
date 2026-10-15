// luma-search.js
// Recherche globale du bureau : logique pure de filtrage local, utilisée par le
// panneau Démarrer. Les fichiers Documents sont recherchés côté serveur
// (GET /api/documents?search=…) et restreints au propriétaire de la session ;
// les applications respectent l'éligibilité du registre (cachées, incompatibles,
// non installées) — jamais d'identifiant fourni par le navigateur.

export const SETTINGS_CATALOG = [
    { view: "system", label: "Système", keywords: "appareil version affichage état santé" },
    { view: "update", label: "Mise à jour", keywords: "version build service worker installation installateur" },
    { view: "personalization", label: "Personnalisation", keywords: "thème couleur fond densité mouvement apparence" },
    { view: "storage", label: "Stockage", keywords: "espace quota corbeille images vidéos musique documents" },
    { view: "backup", label: "Sauvegarde", keywords: "export import restauration réinitialisation données notes" },
    { view: "workspaces", label: "Espaces", keywords: "espace travail bureau disposition fenêtres bascule" },
    { view: "startup", label: "Démarrage", keywords: "réouverture applications session lancement" },
    { view: "network", label: "Réseau Luma", keywords: "local modules connexion synchronisation services" },
    { view: "account", label: "Compte", keywords: "kyros profil quota langue fuseau synchronisation préférences" }
];

const stripAccents = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

export function normalizeQuery(query) {
    return stripAccents(String(query ?? "").trim().toLocaleLowerCase("fr"));
}

function matches(value, normalized) {
    if (!normalized) return true;
    return stripAccents(String(value ?? "").toLocaleLowerCase("fr")).includes(normalized);
}

export function searchApps(apps, { query = "", installed = null } = {}) {
    const normalized = normalizeQuery(query);
    return (Array.isArray(apps) ? apps : []).filter((app) => {
        if (!app || app.hidden || app.incompatible) return false;
        if (app.storeManaged && !installed?.has?.(app.id)) return false;
        return matches(`${app.name || ""} ${app.taskbarName || ""}`, normalized);
    });
}

export function searchEvents(events, query = "") {
    const normalized = normalizeQuery(query);
    if (!normalized) return [];
    return (Array.isArray(events) ? events : [])
        .filter((event) => event && matches(event.title, normalized))
        .slice(0, 5);
}

export function searchSettings(query = "", catalog = SETTINGS_CATALOG) {
    const normalized = normalizeQuery(query);
    if (!normalized) return [];
    return catalog
        .filter((entry) => matches(`${entry.label} ${entry.keywords}`, normalized))
        .slice(0, 5);
}
