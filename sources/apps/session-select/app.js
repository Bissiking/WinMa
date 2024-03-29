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

                        const DataUser = response.data.dataUser;

                        $('#idUser').hide();
                        $('#mdpUser').hide();
                        $('.logo-locked').hide();
                        $('#Infoconnexion').text('Préparation du compte');

                        setTimeout(() => {
                            axios.post('/data/write/user', DataUser)
                                .then(function (response) {
                                    console.log(response);
                                    console.log(response.data.success);
                                    if (response.data.success == true) {
                                        $('#Infoconnexion').text('Récupération des paramètres utilisateurs');

                                        setTimeout(() => {
                                            // Stockage des infos dans le localStorage
                                            localStorage.setItem('UserData', JSON.stringify(DataUser));

                                            // Récupération des paramètres
                                            axios.post('/data/user/params', DataUser).then(function (response) {
                                                let params = response.data.params
                                                if (params !== null) {
                                                    document.body.style.background = "url(" + params.background + ")";
                                                } else {
                                                    document.body.style.background = "url(./images/backgrounds/background-01.jpg)";
                                                }

                                                // Démasquage de la barre des tâches
                                                $('.start-menu').removeClass('hidden');

                                                let UsersDataName = "NoData";
                                                // Enregistrement du nom du users dans le menu démarré
                                                if (DataUser.nomComplet == "" || DataUser.nomComplet == null) {
                                                    UsersDataName = DataUser.identifiant
                                                } else {
                                                    UsersDataName = DataUser.nomComplet
                                                }

                                                $('#nameuser-menu-start-ico-user-name').text(UsersDataName);

                                                // // Appel du bureau
                                                CallPage('desktop');
                                            })
                                        }, 2000);
                                    }
                                }, 2000);
                        });

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


