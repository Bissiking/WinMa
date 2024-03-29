function generateUniqueId() {
    // Préfixe fixe pour l'identifiant
    var prefix = 'window-';
    // Horodatage pour garantir l'unicité
    var timestamp = new Date().getTime();
    // Nombre aléatoire pour garantir l'unicité
    var random = Math.floor(Math.random() * 1000000); // Vous pouvez ajuster la plage de nombres aléatoires si nécessaire

    // Concaténer les parties pour former l'identifiant unique
    var uniqueId = prefix + timestamp + '-' + random;

    return uniqueId;
}