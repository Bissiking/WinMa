$(document).ready(function() {
    // Attacher l'événement de démarrage du déplacement de la fenêtre à un élément parent statique
    $(document).on('mousedown', '.window-header', startWindowDrag);
});

function startWindowDrag(event) {
    // Récupérer la fenêtre parente à partir de l'en-tête
    var windowElement = $(this).closest('.window');

    // Enregistrer la position initiale de la souris et de la fenêtre
    var initialMouseX = event.clientX;
    var initialMouseY = event.clientY;
    var initialWindowX = parseInt(windowElement.css('left')) || 0;
    var initialWindowY = parseInt(windowElement.css('top')) || 0;

    // Ajouter des écouteurs d'événements pour suivre le mouvement de la souris
    $(document).on('mousemove', function(event) {
        dragWindow(event, initialMouseX, initialMouseY, initialWindowX, initialWindowY, windowElement);
    });
    $(document).on('mouseup', stopWindowDrag);
}

function dragWindow(event, initialMouseX, initialMouseY, initialWindowX, initialWindowY, windowElement) {
    // Calculer le déplacement de la souris par rapport à la position initiale
    var deltaX = event.clientX - initialMouseX;
    var deltaY = event.clientY - initialMouseY;

    // Calculer les nouvelles positions de la fenêtre
    var newWindowX = initialWindowX + deltaX;
    var newWindowY = initialWindowY + deltaY;

    // Limiter les positions de la fenêtre pour qu'elle reste à l'intérieur de l'élément "desktop-apps"
    var desktopAppsElement = $('section');
    var desktopAppsOffset = desktopAppsElement.offset();
    var desktopAppsWidth = desktopAppsElement.width();
    var desktopAppsHeight = desktopAppsElement.height();
    var windowWidth = windowElement.outerWidth();
    var windowHeight = windowElement.outerHeight();

    newWindowX = Math.min(Math.max(desktopAppsOffset.left, newWindowX), desktopAppsOffset.left + desktopAppsWidth - windowWidth);
    newWindowY = Math.min(Math.max(desktopAppsOffset.top, newWindowY), desktopAppsOffset.top + desktopAppsHeight - windowHeight);

    // Mettre à jour la position de la fenêtre
    windowElement.css('left', newWindowX + 'px');
    windowElement.css('top', newWindowY + 'px');
}

function stopWindowDrag() {
    // Supprimer les écouteurs d'événements de la souris
    $(document).off('mousemove');
    $(document).off('mouseup');
}
