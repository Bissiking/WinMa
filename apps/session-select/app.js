var ClickDetect = 0;

$('#BtnConnexionWinMa').click(function () {

    if (ClickDetect == 0) {
        ClickDetect = 1;
        $('#BtnConnexionWinMa').hide();

        var apiUrl = 'https://dev.mhemery.fr/api/login';

        // Récupérer les données du formulaire
        var username = document.getElementById('idUser').value;
        var password = document.getElementById('mdpUser').value;

        // Données à envoyer dans la requête POST
        var userData = {
            identifiant: username,
            password: password
        };

        setTimeout(() => {
            // Effectuer la requête POST avec Axios
            axios.post(apiUrl, userData)
                .then(function (response) {
                    console.log('Réponse de l\'API :', response.data);
                    // Gérer la réponse de l'API ici
                    if (response.data.success === true) {
                        // Stockage des infos dans le localStorage
                        localStorage.setItem('UserData', JSON.stringify(response.data.dataUser));
                        document.body.style.background = "url(./images/backgrounds/background-01.jpg)";
                        $('.start-menu').removeClass('hidden');
                        CallPage('desktop');
                    } else {
                        $('#Infoconnexion').text(response.data.message);
                    }

                    ClickDetect = 0;
                    $('#BtnConnexionWinMa').show();
                })
                .catch(function (error) {
                    setTimeout(() => {
                        console.error('Erreur lors de la requête :', error);
                        // Gérer les erreurs de requête ici
                        ClickDetect = 0;
                        $('#BtnConnexionWinMa').hide();
                    }, 4000);
                });
        }, 2000);
    }
})