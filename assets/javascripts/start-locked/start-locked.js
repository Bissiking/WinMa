// // SESSION LOCAL
// // Stockage d'une valeur dans localStorage
// localStorage.setItem('nom', 'valeur');

// // Récupération de la valeur depuis localStorage
// var valeur = localStorage.getItem('nom');
// console.log(valeur); // Affichera 'valeur'


// SESSION Storage

// Stockage d'une valeur dans sessionStorage
// sessionStorage.setItem('nom', 'valeur');

// // Récupération de la valeur depuis sessionStorage
// var valeur = sessionStorage.getItem('nom');
// console.log(valeur); // Affichera 'valeur'

// Vérification du fonctionnement de la variable
if (typeof (Storage) !== "undefined") {
    // Le navigateur prend en charge le stockage local (localStorage et sessionStorage)
    console.log("Le stockage local est disponible.");
} else {
    // Le navigateur ne prend pas en charge le stockage local
    console.log("Désolé, votre navigateur ne prend pas en charge le stockage local.");
}

// Vérifier si la valeur est présente dans sessionStorage
if (sessionStorage.getItem('maCle') !== null) {
    // La valeur est présente
    var maValeur = sessionStorage.getItem('maCle');
    console.log("La valeur est présente : " + maValeur);
} else {
    // La valeur n'est pas présente
    console.log("La valeur n'est pas présente.");
}