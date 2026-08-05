export function mount(root, { app }) {
    const frame = document.createElement("iframe");
    frame.className = "luma-web-frame";
    frame.title = app.name;
    frame.src = app.url;
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    root.append(frame);
    return () => frame.remove();
}
