export async function requestJson(url, options = {}) {
    const response = await fetch(url, {
        credentials: "same-origin",
        headers: { accept: "application/json", ...(options.headers || {}) },
        ...options
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.success === false) {
        const error = new Error(payload.message || "La requête n’a pas abouti.");
        error.status = response.status;
        error.code = payload.code || null;
        if (response.status === 401) {
            // Session expirée ou close depuis un autre appareil : le shell se
            // re-dessine sur l'écran de session (voir luma-shell.js).
            window.dispatchEvent(new CustomEvent("luma:session-expired"));
        }
        throw error;
    }

    return payload.data;
}

export function patchJson(url, body) {
    return requestJson(url, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
    });
}

export function postJson(url, body = {}) {
    return requestJson(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
    });
}

export function putJson(url, body = {}) {
    return requestJson(url, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
    });
}
