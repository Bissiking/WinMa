function currentPeriod() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return "matin";
    if (hour >= 12 && hour < 18) return "apresmidi";
    if (hour >= 18 && hour < 22) return "soir";
    return "nuit";
}

function activeTheme() {
    return document.documentElement.dataset.theme || "luma";
}

function pick(items) {
    return items[Math.floor(Math.random() * items.length)];
}

export function welcomeMessage() {
    const period = currentPeriod();
    const theme = activeTheme();
    const themed = theme === "luma" || theme === "dark"
        ? ["Nouvelle session en vue, {period}.", "Le bureau LUMA vous attend, {period}.", "Branchez votre lumière, {period}."]
        : ["Belle journée pour faire briller vos idées, {period}.", "Un bureau lumineux vous accueille, {period}.", "Tout est clair, {period} : à vous de jouer."];
    const text = pick(themed);
    const periodLabel = {
        matin: "bonne matinée",
        apresmidi: "bon après-midi",
        soir: "bonne soirée",
        nuit: "bonne nuit"
    }[period];
    return text.replace("{period}", periodLabel);
}
