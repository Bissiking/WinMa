let menuElement = null;

function onPointerDown(event) {
    if (menuElement && !menuElement.contains(event.target)) closeContextMenu();
}

function onKeyDown(event) {
    if (event.key === "Escape") closeContextMenu();
}

function onResize() {
    closeContextMenu();
}

export function showContextMenu(x, y, items) {
    closeContextMenu();
    const menu = document.createElement("div");
    menu.className = "context-menu";
    menu.setAttribute("role", "menu");
    for (const item of items) {
        if (item === "separator") {
            menu.append(Object.assign(document.createElement("hr"), { className: "context-menu-separator" }));
            continue;
        }
        const button = document.createElement("button");
        button.type = "button";
        button.className = "context-menu-item";
        if (item.danger) button.classList.add("is-danger");
        button.textContent = item.label;
        button.addEventListener("click", () => { closeContextMenu(); item.action?.(); });
        menu.append(button);
    }
    document.body.append(menu);
    const rect = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - rect.width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - rect.height - 8))}px`;
    menuElement = menu;
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onResize);
}

export function closeContextMenu() {
    if (!menuElement) return;
    menuElement.remove();
    menuElement = null;
    document.removeEventListener("pointerdown", onPointerDown, true);
    document.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("resize", onResize);
}
