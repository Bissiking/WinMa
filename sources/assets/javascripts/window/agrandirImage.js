// Variable pour suivre l'état actuel de l'image (grossissement ou dégrossissment)
var estGrossi = false;

function ajusterTailleImage() {
    // Récupérer la taille de #desktop-apps
    var desktopAppsSize = document.getElementById('desktop-apps').getBoundingClientRect();
    var desktopAppsWidth = desktopAppsSize.width;
    var desktopAppsHeight = desktopAppsSize.height;

    // Sélectionner la fenêtre
    var windowElement = document.querySelector('.window');

    // Vérifier l'état actuel de l'image
    if (estGrossi) {
        // Si l'image est déjà grossie, dégrossir
        windowElement.style.width = '800px'; // Largeur initiale de la fenêtre
        windowElement.style.height = '600px'; // Hauteur initiale de la fenêtre
        estGrossi = false; // Mettre à jour l'état de l'image
    } else {
        // Si l'image n'est pas grossie, grossir
        windowElement.style.width = desktopAppsWidth - 2 + 'px';
        windowElement.style.height = desktopAppsHeight - 50 + 'px';
        windowElement.style.top = '0px'; // Positionner en haut
        windowElement.style.left = '0px'; // Positionner à gauche
        estGrossi = true; // Mettre à jour l'état de l'image
    }
}
