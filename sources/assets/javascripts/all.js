function CallPage(LinkPage) {
    $.ajax({
        type: 'GET',
        url: './apps/' + LinkPage + '/index.html',
        success: function (response) {
            $('#desktop-apps').html(response);
        },
        error: function (error) {
            console.error('Erreur de connexion:', error);
        }
    });
}

// Changer le fond en utilisant une image
document.addEventListener('DOMContentLoaded', function () {
    if (localStorage.getItem('UserData') !== null) {
        // Récupération des paramètres
        setTimeout(() => {
            // Récupération du nom dans la session
            var userData = JSON.parse(localStorage.getItem('UserData'));

            var UsersDataNameAll = "NoData";
            // Enregistrement du nom du users dans le menu démarré
            if (userData.nomComplet == "" || userData.nomComplet == null) {
                UsersDataNameAll = userData.identifiant
            } else {
                UsersDataNameAll = userData.nomComplet
            }
            $('#nameuser-menu-start-ico-user-name').text(UsersDataNameAll);

            axios.post('/data/user/params', userData).then(function (response) {
                let params = response.data.params
                if (params !== null) {
                    $('body').css("background-image","url(" + params.background + ")");
                } else {
                    $('body').css("background-image","url(./images/backgrounds/background-01.jpg)");
                }

                // Démasquage de la barre des tâches
                $('.start-menu').removeClass('hidden');

                let UsersDataName = "NoData";
                // Enregistrement du nom du users dans le menu démarré
                if (userData.nomComplet == "" || userData.nomComplet == null) {
                    UsersDataName = userData.identifiant
                } else {
                    UsersDataName = userData.nomComplet
                }

                $('#nameuser-menu-start-ico-user-name').text(UsersDataName);

                // // Appel du bureau
                CallPage('desktop');
            });
        }, 100);
    } else {
        setTimeout(() => {
            document.body.style.background = "url(./images/locked/locked-01.png)";
            CallPage('session-select');
        }, 3000);
    }
});

$('#btn-menu-start-power-option').on('click', function () {
    let btnMenuStart = $('#menu-menu-start-power-option');
    console.log('click');
    if (btnMenuStart.hasClass('hidden')) {
        btnMenuStart.removeClass('hidden');
    } else {
        btnMenuStart.addClass('hidden');
    }
});

$('#open-start-button').on('click', function () {
    if ($('.menu-start').data('menu-open') !== true) {
        // Si le menu est ouvert, animer son apparition
        $('.menu-start').animate({
            bottom: 60
        }, 200); // Durée de l'animation : 500 ms (0.5 secondes)
        $('.menu-start').data('menu-open', true);
    } else {
        // Si le menu est fermé, animer sa disparition
        $('.menu-start').animate({
            bottom: -1000
        }, 200); // Durée de l'animation : 500 ms (0.5 secondes)
        $('.menu-start').data('menu-open', false);
    }
});

$('.locked-session').click(function () {
    // Supression de la session local
    $('#nameuser-menu-start-ico-user-name').text('NO USERS');
    // Supprimer une clé de localStorage
    localStorage.removeItem('UserData');


    $('.start-menu').addClass('hidden');
    document.body.style.background = "url(./images/locked/locked-01.png)";
    CallPage('session-select');
})