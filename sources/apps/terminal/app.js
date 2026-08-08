import { welcomeMessage } from "../../assets/javascripts/luma-welcome.js";

const COMMANDS = {
    help: { summary: "affiche la liste des commandes" },
    about: { summary: "affiche des informations sur Luma OS" },
    date: { summary: "affiche la date et l'heure actuelles" },
    echo: { summary: "répète le texte saisi" },
    clear: { summary: "efface la console" },
    apps: { summary: "liste les applications disponibles" },
    ps: { summary: "liste les fenêtres ouvertes" },
    open: { summary: "ouvre une application : open <id>" },
    close: { summary: "ferme toutes les fenêtres d'une application : close <id>" },
    luma: { summary: "affiche l'état du système" },
    exit: { summary: "ferme le terminal" },
};

const FALLBACK_IDS = [
    "documents", "calculator", "terminal", "calendar", "settings", "task-manager",
    "luma-orbit", "sonora-studio", "braindump", "notepad", "power", "timer", "trash",
    "image-viewer", "music-player", "video-player", "matheo-systems",
];

export function mount(root, context = {}) {
    const { open = () => {}, getWindows = () => [], closeWindow = () => {}, toast = () => {}, version = "3.1.0", close = () => {}, registry = [], apps = [] } = context;

    const availableApps = registry.length ? registry : apps;
    const availableIds = new Set(availableApps.length ? availableApps.map((item) => item.id) : FALLBACK_IDS);

    let history = [];
    let historyIndex = -1;
    let input = null;
    let activeLine = null;

    root.innerHTML = `
        <div class="terminal-app">
            <div class="terminal-toolbar">
                <div class="terminal-tabs" role="tablist" aria-label="Onglets du terminal">
                    <button type="button" class="terminal-tab is-active" role="tab" aria-selected="true">Terminal</button>
                </div>
            </div>
            <div class="terminal-output" data-terminal-output role="log" aria-live="polite"></div>
        </div>`;

    const output = root.querySelector("[data-terminal-output]");

    function refreshPrompt() {
        activeLine?.remove();
        const line = document.createElement("div");
        line.className = "terminal-line terminal-line--cmd terminal-line--active";
        const prompt = document.createElement("span");
        prompt.className = "terminal-prompt";
        prompt.textContent = "luma@os:~$";
        input = document.createElement("input");
        input.className = "terminal-input";
        input.type = "text";
        input.setAttribute("autocomplete", "off");
        input.setAttribute("autocapitalize", "off");
        input.setAttribute("spellcheck", "false");
        input.setAttribute("aria-label", "Commande");
        input.addEventListener("keydown", onKeyDown);
        line.append(prompt, input);
        output.appendChild(line);
        activeLine = line;
        output.scrollTop = output.scrollHeight;
        input.focus();
    }

    function print(text, className = "") {
        const line = document.createElement("div");
        line.className = `terminal-line${className ? ` ${className}` : ""}`;
        if (className === "terminal-line--cmd") {
            const prompt = document.createElement("span");
            prompt.className = "terminal-prompt";
            prompt.textContent = "luma@os:~$";
            line.append(prompt, document.createTextNode(` ${text}`));
        } else {
            line.textContent = text;
        }
        output.appendChild(line);
        output.scrollTop = output.scrollHeight;
    }

    function printBlocks(blocks) {
        for (const block of blocks) {
            const node = document.createElement("div");
            node.className = "terminal-block";
            node.innerHTML = block
                .map(({ text, tone = "plain" }) => `<span class="terminal-${tone}">${escapeText(text)}</span>`)
                .join(" ");
            output.appendChild(node);
        }
        output.scrollTop = output.scrollHeight;
    }

    function formatDate() {
        return new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "medium" }).format(new Date());
    }

    function run(commandLine) {
        const trimmed = commandLine.trim();
        const parts = trimmed.split(/\s+/);
        const command = parts.shift() || "";
        const args = parts.join(" ");

        print(commandLine, "terminal-line--cmd");
        if (!trimmed) { refreshPrompt(); return; }

        switch (command) {
            case "help": {
                const rows = Object.entries(COMMANDS)
                    .map(([name, { summary }]) => `${name.padEnd(8)}  ${summary}`)
                    .join("\n");
                rows.split("\n").forEach((line) => print(line));
                break;
            }
            case "about":
                print("Luma OS");
                print(`Version ${version}`);
                print("Un bureau web, léger et fluent, pensé pour rester rapide.");
                break;
            case "date":
                print(formatDate());
                break;
            case "echo":
                print(args || "");
                break;
            case "clear":
                activeLine?.remove();
                activeLine = null;
                output.innerHTML = "";
                break;
            case "apps": {
                if (!availableIds.size) {
                    print("  (aucune application enregistrée)");
                    break;
                }
                print("Applications enregistrées :");
                for (const id of availableIds) {
                    const name = availableApps.find((item) => item.id === id)?.name;
                    print(`  • ${id}${name ? `  (${name})` : ""}`);
                }
                break;
            }
            case "ps": {
                const windows = getWindows();
                if (!windows.length) {
                    print("Aucune fenêtre ouverte.");
                    break;
                }
                print("Fenêtres ouvertes :");
                windows.forEach((w) => print(`  • ${w.title || w.appId}  [${w.appId}]`));
                break;
            }
            case "open": {
                const target = args;
                if (!target) { print("Usage : open <id>"); break; }
                if (!availableIds.has(target)) {
                    print(`open : application « ${target} » introuvable.`);
                    break;
                }
                open(target);
                print(`Ouverture de ${target}…`);
                break;
            }
            case "close": {
                const target = args;
                if (!target) { print("Usage : close <id>"); break; }
                const windows = getWindows();
                const matching = windows.filter((w) => w.appId === target);
                if (!matching.length) { print(`Aucune fenêtre de « ${target} » ouverte.`); break; }
                matching.forEach((w) => closeWindow(w.id));
                print(`Fermeture de ${matching.length} fenêtre(s) de ${target}.`);
                break;
            }
            case "luma":
                print(`Luma OS ${version}   · ${getWindows().length} fenêtre(s) ouverte(s)`);
                print("Disponibilité : en ligne");
                break;
            case "sudo": {
                if (args !== "reboot") {
                    print("sudo: permission refusée.");
                    break;
                }
                print("Autorisation du contrôleur de bon sens…");
                print("Firmware 26.8.0-survival détecté.");
                print("Bascule vers le Socket 2 · Mode survie actif.");
                print("Redémarrage planifié, puis annulé par le contrôleur de bon sens.");
                print("Ouverture de Matheo Systems…");
                open("matheo-systems");
                break;
            }
            case "exit":
                print("Fermeture du terminal…");
                toast("Terminal fermé.");
                close();
                break;
            default:
                print(`zsh: commande introuvable : ${command}`);
                print("Tapez « help » pour voir la liste des commandes.");
        }
        refreshPrompt();
    }

    function submit() {
        if (!input) return;
        const value = input.value;
        history = [...history, value];
        historyIndex = history.length;
        activeLine?.remove();
        activeLine = null;
        run(value);
    }

    const onKeyDown = (event) => {
        if (event.key === "Enter") {
            event.preventDefault();
            submit();
            return;
        }
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        if (!history.length) return;
        historyIndex = Math.max(0, Math.min(history.length, historyIndex + (event.key === "ArrowUp" ? -1 : 1)));
        input.value = historyIndex < history.length ? history[historyIndex] : "";
        input.setSelectionRange(input.value.length, input.value.length);
    };

    const onFocus = (event) => {
        if (event.target === input) return;
        input?.focus();
    };

    output.addEventListener("mousedown", onFocus);

    print("Luma OS Terminal");
    print(`Version ${version} — tapez « help » pour la liste des commandes.`);
    print(welcomeMessage());
    refreshPrompt();

    return () => {
        output.removeEventListener("mousedown", onFocus);
    };
}
