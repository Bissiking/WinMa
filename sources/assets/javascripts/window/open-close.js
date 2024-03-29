function CallApps(LinkPage) {
    return new Promise(function(resolve, reject) {
        $.ajax({
            type: 'GET',
            url: './apps/' + LinkPage + '/index.html',
            success: function(response) {
                resolve(response);
            },
            error: function(error) {
                resolve('404 Not found');
                console.error('Erreur de connexion:', error);
            }
        });
    });
}

async function openWindow(apps, nameApps,  callback) {
    try {
        var windowId = generateUniqueId();
        // Créer la fenêtre
        var windowElement = document.createElement('div');
        windowElement.classList.add('window');
        windowElement.id = windowId; // Définir l'identifiant de la fenêtre
        windowElement.style.width = '800px'; // Définir la largeur de la fenêtre
        windowElement.style.height = '600px'; // Définir la hauteur de la fenêtre

        // Ajouter le contenu de l'en-tête
        var headerElement = document.createElement('div');
        headerElement.classList.add('window-header');
        var titleElement = document.createElement('span');
        titleElement.classList.add('window-title');
        titleElement.textContent = nameApps;

        // Création du bouton fermé
        var closeButton = document.createElement('button');
        closeButton.classList.add('close-btn');
        closeButton.textContent = 'X';
        closeButton.addEventListener('click', function() {
            closeWindow(windowId); // Appeler la fonction closeWindow avec l'ID de la fenêtre
        });

        headerElement.appendChild(titleElement);
        headerElement.appendChild(closeButton);

        // Ajouter le bouton agrandir
        var maximizeButton = document.createElement('button');
        maximizeButton.classList.add('maximize-btn');
        maximizeButton.textContent = '⬜'; // Remplacez ce texte par l'icône souhaitée
        maximizeButton.addEventListener('click', function() {
            MaxWindow();
            callback(); // Appel du callback après avoir agrandi l'image
        });
        headerElement.appendChild(maximizeButton);

        // Ajouter les poignées de redimensionnement
        var resizeHandle = document.createElement('div');
        resizeHandle.classList.add('window-resize-handle', 'bottom-right'); // Ajouter les classes à la poignée de redimensionnement
        headerElement.appendChild(resizeHandle); // Ajouter la poignée de redimensionnement à l'en-tête de la fenêtre


        // Ajouter le contenu de la fenêtre
        var contentElement = document.createElement('div');
        contentElement.classList.add('window-content');

        // Charger le contenu de la fenêtre
        let contentApps = await CallApps(apps);
        contentElement.innerHTML = contentApps;

        // Ajouter les éléments à la fenêtre
        windowElement.appendChild(headerElement);
        windowElement.appendChild(contentElement);

        // Ajouter la fenêtre au corps du document
        document.body.appendChild(windowElement);
    } catch (error) {
        console.error('Erreur lors de l\'ouverture de la fenêtre:', error);
    }
}

function MaxWindow() {
    ajusterTailleImage();
};

function closeWindow(windowId) {
    $('#' + windowId).remove(); // Supprimer la fenêtre avec l'ID spécifié
}
