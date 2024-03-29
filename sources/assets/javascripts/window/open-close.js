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

async function openWindow(apps) {
    try {
        // Créer la fenêtre
        var windowElement = document.createElement('div');
        windowElement.classList.add('window');

        // Ajouter le contenu de l'en-tête
        var headerElement = document.createElement('div');
        headerElement.classList.add('window-header');
        var titleElement = document.createElement('span');
        titleElement.classList.add('window-title');
        titleElement.textContent = 'Ma fenêtre';
        var closeButton = document.createElement('button');
        closeButton.classList.add('close-btn');
        closeButton.textContent = 'X';
        closeButton.addEventListener('click', closeWindow);
        headerElement.appendChild(titleElement);
        headerElement.appendChild(closeButton);

        toggleFullScreen

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

function closeWindow() {
    var windowElement = document.querySelector('.window');
    if (windowElement) {
        windowElement.remove();
    }
}
