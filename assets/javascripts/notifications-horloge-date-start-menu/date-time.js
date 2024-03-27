// Obtenir la date actuelle
function getDate() {
    var currentDate = new Date();
    var day = currentDate.getDate();
    var month = currentDate.getMonth() + 1; // Les mois sont indexés à partir de zéro
    var year = currentDate.getFullYear();

    // Ajoute un zéro en tête si nécessaire pour garder le format (par exemple, '01' pour janvier)
    if (day < 10) {
        day = '0' + day;
    }
    if (month < 10) {
        month = '0' + month;
    }

    var formattedDate = day + '/' + month + '/' + year;
    return formattedDate;
}

// Obtenir l'heure actuelle
function getTime() {
    var currentTime = new Date();
    var hours = currentTime.getHours();
    var minutes = currentTime.getMinutes();
    var seconds = currentTime.getSeconds();

    // Ajoute un zéro en tête si nécessaire pour garder le format (par exemple, '09' pour 9h)
    if (hours < 10) {
        hours = '0' + hours;
    }
    if (minutes < 10) {
        minutes = '0' + minutes;
    }
    if (seconds < 10) {
        seconds = '0' + seconds;
    }

    var formattedTime = hours + ':' + minutes + ':' + seconds;
    return formattedTime;
}

// Utilisation des fonctions pour obtenir la date et l'heure séparément
function DateHeuresNotif() {
    $('#horloge-notifications-horloge-date-start-menu').text(getTime());
    $('#date-notifications-horloge-date-start-menu').text(getDate());
}
// First start
DateHeuresNotif();
setInterval(() => {
    DateHeuresNotif();
}, 1000);