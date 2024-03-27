function CallPage(LinkPage) {
    $.ajax({
        type: 'GET',
        url: './apps/' + LinkPage + '/index.html',
        success: function (response) {
            console.log(response);
            $('#desktop-apps').html(response);
        },
        error: function (error) {
            console.error('Erreur de connexion:', error);
        }
    });
}

// Vérifier si la valeur est présente dans sessionStorage
if (sessionStorage.getItem('maCle') !== null) {
    // La valeur est présente
    var maValeur = sessionStorage.getItem('maCle');
    console.log("La valeur est présente : " + maValeur);
} else {
    // La valeur n'est pas présente
    console.log("La valeur n'est pas présente.");
    CallPage('session-select');
}