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
    { id: "55555555-5555-4555-8555-555555555555", parentId: null, kind: "file", name: "Budget prévisionnel.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 18432, createdAt: "2026-08-01T11:00:00.000Z", updatedAt: "2026-08-03T13:05:00.000Z", trashedAt: null },
    { id: "66666666-6666-4666-8666-666666666666", parentId: null, kind: "file", name: "Bienvenue.md", mimeType: "text/markdown", size: 29, createdAt: "2026-08-01T11:00:00.000Z", updatedAt: "2026-08-03T13:05:00.000Z", trashedAt: null },
    { id: "77777777-7777-4777-8777-777777777777", parentId: null, kind: "file", name: "Aurore.svg", mimeType: "image/svg+xml", size: 180, createdAt: "2026-08-01T11:00:00.000Z", updatedAt: "2026-08-03T13:05:00.000Z", trashedAt: null },
    { id: "88888888-8888-4888-8888-888888888888", parentId: null, kind: "file", name: "Aurore boréale.wav", mimeType: "audio/wav", size: 42000, createdAt: "2026-08-01T11:00:00.000Z", updatedAt: "2026-08-03T13:05:00.000Z", trashedAt: null },
    { id: "99999999-9999-4999-9999-999999999999", parentId: null, kind: "file", name: "Aurore boréale.mp4", mimeType: "video/mp4", size: 860000, createdAt: "2026-08-01T11:00:00.000Z", updatedAt: "2026-08-03T13:05:00.000Z", trashedAt: null }
];

async function configure(page) {
    let settings = { wallpaper: "./images/backgrounds/luma-aurora.webp", theme: "luma", accentColor: "#6d5ee8", density: "comfortable", motion: "system" };
    let preferences = { preferredName: "", language: "fr-FR", timeZone: "auto", syncProfile: true, syncAppearance: true };
    const storage = { usedBytes: 3619635, quotaBytes: 1073741824, availableBytes: 1070122189 };
    let brainNotes = [
        { id: 3, content: "Préparer la présentation de Luma OS vendredi", type: "task", priority: "high", project: "LUMA", dueDate: "2026-08-07T09:00:00.000Z", tags: ["frontend"], confidence: 91, createdAt: "2026-08-06T09:20:00.000Z" },
        { id: 2, content: "Idée : relier BrainDump au bureau LUMA", type: "idea", priority: "normal", project: "LUMA", dueDate: null, tags: ["api"], confidence: 88, createdAt: "2026-08-05T16:10:00.000Z" },
        { id: 1, content: "Ne pas oublier la rotation des jetons Kyros", type: "reminder", priority: "normal", project: "Kyros", dueDate: "2026-08-08T08:00:00.000Z", tags: ["security"], confidence: 94, createdAt: "2026-08-04T11:30:00.000Z" }
    ];
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
        if (pathname.endsWith("/download") || pathname.endsWith("/preview")) {
            if (pathname.includes("88888888-8888-4888-8888-888888888888")) {
                const header = Buffer.alloc(44);
                header.write("RIFF", 0); header.writeUInt32LE(36 + 2, 4); header.write("WAVE", 8); header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(8000, 24); header.writeUInt32LE(16000, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write("data", 36); header.writeUInt32LE(2, 40);
                await route.fulfill({ status: 200, contentType: "audio/wav", body: Buffer.concat([header, Buffer.from([0x80, 0x80])]) });
            } else if (pathname.includes("99999999-9999-4999-9999-999999999999")) {
                await route.fulfill({ status: 200, contentType: "video/mp4", body: Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d]) });
            } else {
                await route.fulfill({ status: 200, contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="#172553"/><circle cx="320" cy="180" r="110" fill="#6d5ee8"/></svg>' });
            }
            return;
        }
        if (pathname === "/api/session") data = { authenticated: true, user: { id: "usr_visual", username: "matheo", displayName: "Mathéo" }, authentication: { available: true } };
        else if (pathname === "/api/health") data = { status: "ok", version: "3.1.0" };
        else if (pathname === "/api/system/metrics") data = { timestamp: new Date().toISOString(), cpu: { percent: 18.4, logicalCores: 8, loadAverage: [1.47, 1.2, .98] }, memory: { totalBytes: 17179869184, usedBytes: 7301444403, availableBytes: 9878424781, percent: 42.5 }, runtime: { uptimeSeconds: 840, processMemoryBytes: 94371840 }, user: { id: "usr_visual", username: "matheo", displayName: "Mathéo" } };
        else if (pathname === "/api/users/me/settings") {
            if (request.method() === "PATCH") settings = { ...settings, ...request.postDataJSON() };
            data = settings;
        } else if (pathname === "/api/users/me/windows") {
            data = request.method() === "GET" ? { windows: [] } : { windows: request.postDataJSON()?.windows || [], updatedAt: new Date().toISOString() };
        } else if (pathname === "/api/users/me/account") {
            if (request.method() === "PATCH") preferences = { ...preferences, ...request.postDataJSON() };
            data = accountView();
        } else if (pathname === "/api/users/me/context") {
            data = { schemaVersion: 1, profile: preferences.syncProfile ? preferences : null, appearance: preferences.syncAppearance ? settings : null };
        } else if (pathname === "/api/braindump/notes" && request.method() === "GET") data = brainNotes;
        else if (pathname === "/api/braindump/analyze") data = { type: "task", priority: "high", project: "LUMA", dueDate: "2026-08-07T09:00:00.000Z", tags: ["frontend"], confidence: 92 };
        else if (pathname === "/api/braindump/notes" && request.method() === "POST") {
            const created = { id: 4, content: request.postDataJSON().content, type: "task", priority: "high", project: "LUMA", dueDate: null, tags: [], confidence: 90, createdAt: new Date().toISOString() };
            brainNotes = [created, ...brainNotes];
            data = created;
        } else if (/^\/api\/braindump\/notes\/\d+$/.test(pathname) && request.method() === "DELETE") {
            brainNotes = brainNotes.filter((note) => String(note.id) !== pathname.split("/").at(-1));
            data = null;
        } else if (pathname === "/api/apps") {
            data = [
                { id: "documents", name: "Documents", type: "system" },
                { id: "trash", name: "Corbeille", type: "system" },
                { id: "settings", name: "Paramètres", type: "internal" }
            ];
        } else if (pathname === "/api/documents/folders") data = [{ id: null, parentId: null, name: "Mes fichiers" }, ...sampleItems.filter((item) => item.kind === "folder")];
        else if (pathname.endsWith("/content")) data = request.method() === "GET" ? { item: sampleItems[5], content: "# Bienvenue\n\nUne note **Luma**." } : sampleItems[5];
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
await desktop.locator('[data-settings-view="personalization"]').first().click();
await desktop.locator(".wallpaper-options").waitFor();
if (await desktop.locator("[data-wallpaper-value]").count() !== 17) throw new Error("La galerie ne contient pas tous les arrière-plans disponibles.");
if (await desktop.locator("[data-wallpaper-value] small").count() !== 4) throw new Error("Les quatre arrière-plans 4K n’ont pas leur badge.");

const settingsWindow = desktop.locator('.luma-window[aria-label="Paramètres"]');
await settingsWindow.locator('[data-window-action="minimize"]').click();
if (await settingsWindow.getAttribute("data-state") !== "minimized") throw new Error("La fenêtre Paramètres ne reste pas réduite.");
await desktop.locator('.taskbar-app[aria-label="Paramètres"]').click();
await settingsWindow.locator('[data-settings-view="system"]').first().click();
await settingsWindow.locator(".system-device").waitFor();
if (!await settingsWindow.getByText("3.1.0").isVisible()) throw new Error("La version de package.json n’est pas affichée.");
const sidebarTop = await settingsWindow.locator(".settings-sidebar").evaluate((element) => element.getBoundingClientRect().top);
await settingsWindow.locator(".settings-content").evaluate((element) => { element.scrollTop = element.scrollHeight; });
const sidebarTopAfterScroll = await settingsWindow.locator(".settings-sidebar").evaluate((element) => element.getBoundingClientRect().top);
if (sidebarTop !== sidebarTopAfterScroll) throw new Error("La sidebar Paramètres bouge encore avec le contenu.");
await settingsWindow.locator('[data-settings-view="network"]').first().click();
await settingsWindow.locator(".luma-network-summary").waitFor();

await desktop.locator("#luma-launcher").click();
await desktop.locator('.start-app[data-open-app="documents"]').click();
const documentsWindow = desktop.locator('.luma-window[aria-label="Documents"]');
await documentsWindow.locator('.document-row:has-text("Bienvenue.md")').dblclick();
const noteWindow = desktop.locator('.luma-window[aria-label="Bienvenue.md"]');
await noteWindow.locator("[data-note-editor]").waitFor();
if (!await noteWindow.locator("[data-note-editor]").inputValue()) throw new Error("Le fichier Markdown ne s’ouvre pas dans le Bloc-notes.");
await noteWindow.locator('[data-window-action="minimize"]').click();
await documentsWindow.locator('.document-row:has-text("Aurore.svg")').dblclick();
const imageWindow = desktop.locator('.luma-window[aria-label="Aurore.svg"]');
await imageWindow.locator(".image-viewer-canvas img").waitFor();
await imageWindow.locator('[data-window-action="minimize"]').click();
await documentsWindow.locator('.document-row:has-text("Aurore boréale.wav")').dblclick();
const musicWindow = desktop.locator('.luma-window[aria-label="Aurore boréale.wav"]');
await musicWindow.locator(".music-player").waitFor();
await musicWindow.locator(".music-player[data-state='ready']").waitFor();
if (!await musicWindow.getByText("Aurore boréale").first().isVisible()) throw new Error("Le lecteur de musique n’affiche pas le titre de la piste.");
await desktop.waitForTimeout(300);
if (!skipScreenshots) await desktop.screenshot({ path: `${outputDirectory}music-player-desktop.png`, fullPage: true });
await musicWindow.locator('[data-window-action="minimize"]').click();
await documentsWindow.locator('.document-row:has-text("Aurore boréale.mp4")').dblclick();
const videoWindow = desktop.locator('.luma-window[aria-label="Aurore boréale.mp4"]');
await videoWindow.locator(".video-player").waitFor();
if (!await videoWindow.getByText("Aurore boréale").first().isVisible()) throw new Error("Le lecteur vidéo n’affiche pas le titre de la vidéo.");
await desktop.waitForTimeout(300);
if (!skipScreenshots) await desktop.screenshot({ path: `${outputDirectory}video-player-desktop.png`, fullPage: true });
await videoWindow.locator('[data-window-action="minimize"]').click();

await desktop.locator("#luma-launcher").click();
await desktop.locator('.start-app[data-open-app="task-manager"]').click();
const taskWindow = desktop.locator('.luma-window[aria-label="Gestionnaire des tâches"]');
await taskWindow.locator(".task-manager-app").waitFor();
if (!await taskWindow.getByText("18,4 %").isVisible()) throw new Error("Le Gestionnaire des tâches n’affiche pas le CPU.");
await taskWindow.locator('[data-task-view="startup"]').click();
if (await taskWindow.locator("[data-startup-app]").count() < 5) throw new Error("La gestion des applications au démarrage est incomplète.");
await taskWindow.locator('[data-task-view="processes"]').click();
const beforeResize = await taskWindow.boundingBox();
const resizeHandle = taskWindow.locator(".window-resize--se");
const handleBox = await resizeHandle.boundingBox();
await desktop.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
await desktop.mouse.down();
await desktop.mouse.move(2000, 1200);
await desktop.mouse.up();
const afterResize = await taskWindow.boundingBox();
const layerBox = await desktop.locator("#window-layer").boundingBox();
if (afterResize.width <= beforeResize.width || afterResize.x + afterResize.width > layerBox.x + layerBox.width + 1 || afterResize.y + afterResize.height > layerBox.y + layerBox.height + 1) throw new Error("Le redimensionnement ne reste pas dans la zone du bureau.");
await desktop.waitForTimeout(350);
if (!skipScreenshots) await desktop.screenshot({ path: `${outputDirectory}luma-task-manager-desktop.png`, fullPage: true });
await taskWindow.locator('[data-window-action="minimize"]').click();

await desktop.locator("#luma-launcher").click();
await desktop.locator('.start-app[data-open-app="luma-orbit"]').click();
const orbitWindow = desktop.locator('.luma-window[aria-label="Luma Orbit"]');
await orbitWindow.locator(".orbit-app").waitFor();
if (await orbitWindow.locator(".orbit-row").count() !== 5) throw new Error("Le catalogue Luma Orbit est incomplet.");
await desktop.waitForTimeout(600);
if (!skipScreenshots) await desktop.screenshot({ path: `${outputDirectory}luma-orbit-desktop.png`, fullPage: true });
await orbitWindow.locator('[data-orbit-open="braindump"]').first().click();
await orbitWindow.locator(".orbit-detail").waitFor();
if (!await orbitWindow.getByText("À propos").isVisible()) throw new Error("La fiche produit de Luma Orbit ne s’affiche pas.");
await desktop.waitForTimeout(500);
if (!skipScreenshots) await desktop.screenshot({ path: `${outputDirectory}luma-orbit-detail-desktop.png`, fullPage: true });
await orbitWindow.locator('[data-orbit-back]').click();
await orbitWindow.locator('[data-orbit-action="braindump"]').click();
await orbitWindow.locator('[data-orbit-action="braindump"]').click();
const brainDumpWindow = desktop.locator('.luma-window[aria-label="BrainDump"]');
await brainDumpWindow.locator(".braindump-app").waitFor();
await brainDumpWindow.locator("[data-note]").fill("Préparer le déploiement LUMA demain");
await brainDumpWindow.locator("[data-analyze]").click();
await brainDumpWindow.locator(".braindump-analysis").waitFor();
await brainDumpWindow.locator("[data-save]").click();
await brainDumpWindow.getByText("Préparer le déploiement LUMA demain").waitFor();
const brainDumpWidth = await brainDumpWindow.locator(".braindump-app").evaluate((element) => ({ width: element.scrollWidth, client: element.clientWidth }));
if (brainDumpWidth.width > brainDumpWidth.client + 2) throw new Error("BrainDump déborde horizontalement sur desktop.");
await desktop.waitForTimeout(350);
if (!skipScreenshots) await desktop.screenshot({ path: `${outputDirectory}braindump-desktop.png`, fullPage: true });
await brainDumpWindow.locator('[data-window-action="minimize"]').click();
await orbitWindow.locator('[data-window-action="minimize"]').click();
await desktop.locator("#luma-launcher").click();
await desktop.locator('.start-app[data-open-app="luma-orbit"]').click();
await orbitWindow.locator(".orbit-app").waitFor();
await orbitWindow.locator('[data-orbit-open="braindump"]').first().click();
await orbitWindow.locator(".orbit-detail").waitFor();
await orbitWindow.locator('[data-orbit-uninstall="braindump"]').click();
await orbitWindow.locator('[data-orbit-uninstall="braindump"]').waitFor({ state: "detached" });
await orbitWindow.locator('[data-orbit-back]').click();
await orbitWindow.locator(".orbit-row").first().waitFor();
if (await orbitWindow.locator('[data-orbit-uninstall="braindump"]').count() !== 0) throw new Error("L’application BrainDump n’a pas été désinstallée.");
await desktop.locator("#luma-launcher").click();
if (await desktop.locator('.start-app[data-open-app="braindump"]').count() !== 0) throw new Error("L’application désinstallée reste dans le menu Démarrer.");
await desktop.locator("#luma-launcher").click();
await desktop.evaluate(() => window.LumaOS.openApp("matheo-systems"));
const matheoSystemsWindow = desktop.locator('.luma-window[aria-label="Matheo Systems"]');
await matheoSystemsWindow.locator(".matheo-systems-app").waitFor();
if (!await matheoSystemsWindow.getByText("126 cœurs · 252 threads").isVisible()) throw new Error("Matheo Systems ne présente pas le socket principal.");
await matheoSystemsWindow.locator('[data-ms-view="diagnostic"]').click();
if (!await matheoSystemsWindow.getByText("≈ 8 %").isVisible()) throw new Error("Le diagnostic Matheo Systems est incomplet.");
await matheoSystemsWindow.locator('[data-ms-view="overview"]').click();
await desktop.waitForTimeout(600);
if (!skipScreenshots) await desktop.screenshot({ path: `${outputDirectory}matheo-systems-desktop.png`, fullPage: true });
const pinnedApps = await desktop.locator('#taskbar-apps .taskbar-app.taskbar-pinned').evaluateAll((items) => items.map((item) => item.dataset.appId));
for (const expected of ["documents", "calendar", "task-manager", "terminal"]) {
    if (!pinnedApps.includes(expected)) throw new Error(`L’application « ${expected} » n’est pas épinglée à la barre des tâches.`);
}
const pinnedWidths = await desktop.locator('#taskbar-apps .taskbar-app.taskbar-pinned').evaluateAll((items) => items.map((item) => item.getBoundingClientRect().width));
if (pinnedWidths.some((width) => width > 45)) throw new Error("Une icône épinglée de la barre des tâches dépasse la taille d’icône.");
await desktop.locator("#luma-launcher").click();
await desktop.locator('.start-app[data-open-app="notepad"]').click();
const crowdedTaskbar = desktop.locator('#taskbar-apps[data-layout="icons"]');
await crowdedTaskbar.waitFor();
await desktop.locator('.luma-window[aria-label="Bloc-notes"] [data-window-action="minimize"]').click();
const taskWidths = await crowdedTaskbar.locator(".taskbar-app").evaluateAll((items) => items.map((item) => item.getBoundingClientRect().width));
if (taskWidths.some((width) => width > 45)) throw new Error("Une icône de la barre des tâches dépasse la taille d’icône.");
const taskbarBounds = await desktop.locator(".taskbar").boundingBox();
if (taskbarBounds.x < 0 || taskbarBounds.x + taskbarBounds.width > 1440) throw new Error("La barre des tâches dépasse du viewport.");
if (!skipScreenshots) await desktop.screenshot({ path: `${outputDirectory}luma-taskbar-crowded-desktop.png`, fullPage: true });

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
await mobile.locator(".toast").waitFor({ state: "detached" });
await mobile.locator('.luma-window[aria-label="Paramètres"] [data-window-action="minimize"]').click();
await mobile.locator("#luma-launcher").click();
await mobile.locator('.start-app[data-open-app="luma-orbit"]').click();
await mobile.locator('.luma-window[aria-label="Luma Orbit"] .orbit-app').waitFor();
const mobileOrbitWidth = await mobile.locator('.luma-window[aria-label="Luma Orbit"] .orbit-app').evaluate((element) => ({ width: element.scrollWidth, client: element.clientWidth }));
if (mobileOrbitWidth.width > mobileOrbitWidth.client + 2) throw new Error("Luma Orbit déborde horizontalement sur mobile.");
await mobile.waitForTimeout(600);
if (!skipScreenshots) await mobile.screenshot({ path: `${outputDirectory}luma-orbit-mobile.png`, fullPage: true });
await mobile.locator('.luma-window[aria-label="Luma Orbit"] [data-window-action="minimize"]').click();
await mobile.evaluate(() => window.LumaOS.openApp("braindump"));
const mobileBrainDump = mobile.locator('.luma-window[aria-label="BrainDump"]');
await mobileBrainDump.locator(".braindump-app").waitFor();
const mobileBrainDumpWidth = await mobileBrainDump.locator(".braindump-app").evaluate((element) => ({ width: element.scrollWidth, client: element.clientWidth }));
if (mobileBrainDumpWidth.width > mobileBrainDumpWidth.client + 2) throw new Error("BrainDump déborde horizontalement sur mobile.");
await mobile.waitForTimeout(350);
if (!skipScreenshots) await mobile.screenshot({ path: `${outputDirectory}braindump-mobile.png`, fullPage: true });
await mobileBrainDump.locator('[data-window-action="minimize"]').click();
await mobile.evaluate(() => window.LumaOS.openApp("matheo-systems"));
const mobileMatheo = mobile.locator('.luma-window[aria-label="Matheo Systems"]');
await mobileMatheo.locator(".matheo-systems-app").waitFor();
const mobileMatheoWidth = await mobileMatheo.locator(".matheo-systems-app").evaluate((element) => ({ width: element.scrollWidth, client: element.clientWidth }));
if (mobileMatheoWidth.width > mobileMatheoWidth.client + 2) throw new Error("Matheo Systems déborde horizontalement sur mobile.");
await mobile.waitForTimeout(600);
if (!skipScreenshots) await mobile.screenshot({ path: `${outputDirectory}matheo-systems-mobile.png`, fullPage: true });

await browser.close();
if (errors.length) {
    throw new Error(`Erreurs navigateur:\n${errors.join("\n")}`);
}
console.log(skipScreenshots
    ? "Visual checks passed: desktop and narrow responsive interactions validated."
    : "Visual checks passed: desktop and narrow responsive screenshots captured.");
