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
        $('.start-menu').removeClass('hidden');
        document.body.style.background = "url(./images/backgrounds/background-01.jpg)";
        CallPage('desktop');
    } else {
        setTimeout(() => {
            document.body.style.background = "url(./images/locked/locked-01.png)";
            CallPage('session-select');
        }, 10000);
    }
});

$('#btn-menu-start-power-option').on('click', function() {
    let btnMenuStart = $('#menu-menu-start-power-option');
    console.log('click');
    if (btnMenuStart.hasClass('hidden')) {
        btnMenuStart.removeClass('hidden');
    }else{
        btnMenuStart.addClass('hidden');
    }
});

$('#open-start-button').on('click', function() {
    if ($('.menu-start').data('menu-open') !== true) {
        // Si le menu est ouvert, animer son apparition
        $('.menu-start').animate({ bottom: 60 }, 200); // Durée de l'animation : 500 ms (0.5 secondes)
        $('.menu-start').data('menu-open', true);
    } else {
        // Si le menu est fermé, animer sa disparition
        $('.menu-start').animate({ bottom: -1000 }, 200); // Durée de l'animation : 500 ms (0.5 secondes)
        $('.menu-start').data('menu-open', false);
    }
});