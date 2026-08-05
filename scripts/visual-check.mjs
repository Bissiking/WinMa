import { chromium } from "playwright-core";

const baseUrl = process.env.LUMA_VISUAL_BASE_URL || "http://127.0.0.1:3210";
const outputDirectory = new URL("../.impeccable/quality-bar/", import.meta.url).pathname;
const skipScreenshots = process.env.LUMA_SKIP_SCREENSHOTS === "1";
const browser = await chromium.launch({ executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
const errors = [];

const sampleItems = [
    { id: "11111111-1111-4111-8111-111111111111", parentId: null, kind: "folder", name: "Projets", mimeType: null, size: 0, createdAt: "2026-08-03T11:00:00.000Z", updatedAt: "2026-08-05T09:22:00.000Z", trashedAt: null },
    { id: "22222222-2222-4222-8222-222222222222", parentId: null, kind: "folder", name: "Notes", mimeType: null, size: 0, createdAt: "2026-08-02T11:00:00.000Z", updatedAt: "2026-08-04T15:10:00.000Z", trashedAt: null },
    { id: "33333333-3333-4333-8333-333333333333", parentId: null, kind: "file", name: "Brief produit.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", size: 245760, createdAt: "2026-08-01T11:00:00.000Z", updatedAt: "2026-08-05T08:45:00.000Z", trashedAt: null },
    { id: "44444444-4444-4444-8444-444444444444", parentId: null, kind: "file", name: "Présentation Luma.pdf", mimeType: "application/pdf", size: 3355443, createdAt: "2026-08-01T11:00:00.000Z", updatedAt: "2026-08-04T16:30:00.000Z", trashedAt: null },
    { id: "55555555-5555-4555-8555-555555555555", parentId: null, kind: "file", name: "Budget prévisionnel.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 18432, createdAt: "2026-08-01T11:00:00.000Z", updatedAt: "2026-08-03T13:05:00.000Z", trashedAt: null }
];

async function configure(page) {
    let settings = { wallpaper: "./images/backgrounds/luma-aurora.webp", theme: "luma", accentColor: "#6d5ee8", density: "comfortable", motion: "system" };
    let preferences = { preferredName: "", language: "fr-FR", timeZone: "auto", syncProfile: true, syncAppearance: true };
    const storage = { usedBytes: 3619635, quotaBytes: 1073741824, availableBytes: 1070122189 };
    const accountView = () => ({
        identity: { username: "matheo", displayName: "Mathéo", provider: "Kyros" },
        preferences,
        storage,
        synchronization: { availableModules: 3, profileEnabled: preferences.syncProfile, appearanceEnabled: preferences.syncAppearance }
    });
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/**", async (route) => {
        const request = route.request();
        const pathname = new URL(request.url()).pathname;
        let data;
        if (pathname === "/api/session") data = { authenticated: true, user: { id: "usr_visual", username: "matheo", displayName: "Mathéo" }, authentication: { available: true } };
        else if (pathname === "/api/users/me/settings") {
            if (request.method() === "PATCH") settings = { ...settings, ...request.postDataJSON() };
            data = settings;
        } else if (pathname === "/api/users/me/account") {
            if (request.method() === "PATCH") preferences = { ...preferences, ...request.postDataJSON() };
            data = accountView();
        } else if (pathname === "/api/users/me/context") {
            data = { schemaVersion: 1, profile: preferences.syncProfile ? preferences : null, appearance: preferences.syncAppearance ? settings : null };
        } else if (pathname === "/api/apps") {
            data = [
                { id: "documents", name: "Documents", type: "system" },
                { id: "trash", name: "Corbeille", type: "system" },
                { id: "settings", name: "Paramètres", type: "internal" },
                { id: "browser", name: "Navigateur LUMA", type: "iframe" },
                { id: "jellyfin", name: "Jellyfin", type: "iframe" }
            ];
        } else if (pathname === "/api/documents/folders") data = [{ id: null, parentId: null, name: "Mes fichiers" }, ...sampleItems.filter((item) => item.kind === "folder")];
        else if (pathname === "/api/documents") data = { items: sampleItems, breadcrumbs: [], storage, retentionDays: 30 };
        else data = {};
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true, data, message: null }) });
    });
}

const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await configure(desktop);
await desktop.goto(baseUrl, { waitUntil: "networkidle" });
await desktop.locator("#luma-launcher").click();
await desktop.locator('.start-app[data-open-app="settings"]').click();
await desktop.locator(".settings-app").waitFor();

const settingsWindow = desktop.locator('.luma-window[aria-label="Paramètres"]');
await settingsWindow.locator('[data-window-action="minimize"]').click();
if (await settingsWindow.getAttribute("data-state") !== "minimized") throw new Error("La fenêtre Paramètres ne reste pas réduite.");
await desktop.locator('.taskbar-app[aria-label="Paramètres"]').click();
await settingsWindow.locator('[data-settings-view="system"]').first().click();
await settingsWindow.locator(".system-device").waitFor();
await settingsWindow.locator('[data-settings-view="network"]').first().click();
await settingsWindow.locator(".luma-network-summary").waitFor();
await desktop.waitForTimeout(600);
if (!skipScreenshots) await desktop.screenshot({ path: `${outputDirectory}luma-settings-network-desktop.png`, fullPage: true });

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
await configure(mobile);
await mobile.goto(baseUrl, { waitUntil: "networkidle" });
await mobile.locator("#luma-launcher").click();
await mobile.locator('.start-app[data-open-app="settings"]').click();
await mobile.locator(".settings-app").waitFor();
await mobile.locator('.settings-mobile-nav [data-settings-view="account"]').click();
await mobile.locator(".account-form").waitFor();
await mobile.locator('.account-form input[name="preferredName"]').fill("Mathéo Luma");
await mobile.locator('.account-form button[type="submit"]').click();
await mobile.locator(".account-identity h2").filter({ hasText: "Mathéo Luma" }).waitFor();
if (await mobile.locator(".settings-heading h1").textContent() !== "Compte") throw new Error("Le titre Compte est absent après enregistrement.");
const accountScroll = await mobile.locator(".window-content").evaluate((element) => element.scrollTop);
if (accountScroll !== 0) throw new Error("La vue Compte ne revient pas en haut après enregistrement.");
await mobile.waitForTimeout(600);
if (!skipScreenshots) await mobile.screenshot({ path: `${outputDirectory}luma-settings-account-mobile.png`, fullPage: true });

await browser.close();
if (errors.length) {
    throw new Error(`Erreurs navigateur:\n${errors.join("\n")}`);
}
console.log(skipScreenshots
    ? "Visual checks passed: desktop and narrow responsive interactions validated."
    : "Visual checks passed: desktop and narrow responsive screenshots captured.");
