export async function requestJson(url, options = {}) {
    const response = await fetch(url, {
        credentials: "same-origin",
        headers: { accept: "application/json", ...(options.headers || {}) },
        ...options
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || payload.success === false) {
        throw new Error(payload.message || "La requête n’a pas abouti.");
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
