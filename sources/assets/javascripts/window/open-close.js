function CallApps(LinkPage) {
    return new Promise(function(resolve) {
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

async function openWindow(apps, nameApps, callback) {
    try {
        var windowId = generateUniqueId();
        // Créer la fenêtre
        var windowElement = $('<div></div>').addClass('window').attr('id', windowId);
        windowElement.css({ width: '800px', height: '600px' });

        // Ajouter le contenu de l'en-tête
        var headerElement = $('<div></div>').addClass('window-header');
        var titleElement = $('<span></span>').addClass('window-title').text(nameApps);

        // Création du bouton fermé
        var closeButton = $('<button></button>').addClass('close-btn').text('X');
        closeButton.on('click', function() {
            closeWindow(windowId); // Appeler la fonction closeWindow avec l'ID de la fenêtre
        });

        headerElement.append(titleElement, closeButton);

        // Ajouter le bouton agrandir
        var maximizeButton = $('<button></button>').addClass('maximize-btn').text('⬜');
        maximizeButton.on('click', function() {
            MaxWindow();
            // callback(); // Appel du callback après avoir agrandi l'image
        });
        headerElement.append(maximizeButton);

        // Ajouter les poignées de redimensionnement
        var resizeHandle = $('<div></div>').addClass('window-resize-handle bottom-right');
        headerElement.append(resizeHandle);

        // Ajouter le contenu de la fenêtre
        var contentElement = $('<div></div>').addClass('window-content');

        // Charger le contenu de la fenêtre
        $.ajax({
            url: './apps/' + apps + '/index.html', // L'url de la page à charger
            type: 'GET',
            success: function(response) {
                // Ajouter le contenu à la fenêtre
                contentElement.html(response);
                windowElement.append(headerElement, contentElement);
            },
            error: function(error) {
                console.error('Erreur lors du chargement du contenu:', error);
            }
        });

        // Ajouter la fenêtre au corps du document
        $('body').append(windowElement);
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
