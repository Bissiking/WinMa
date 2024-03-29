const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;

if (!fs.existsSync('users')) {
    fs.mkdirSync('users', {
        recursive: true
    });
}

// Middleware pour le corps de la demande
app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));

// Définir le répertoire des fichiers statiques (comme les fichiers HTML, CSS, etc.)
app.use(express.static(path.join(__dirname, 'sources')));

// Route pour la page d'accueil
app.get('/', (req, res) => {
    // Envoyer le fichier index.html
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/data/write/user', (req, res) => {
    const userData = req.body;
    const userFolder = path.join(__dirname, 'users', JSON.stringify(userData.id));

    // Créer un dossier avec l'ID de l'utilisateur
    fs.mkdirSync(userFolder, {
        recursive: true
    });

    // Chemin du fichier utilisateur
    const userFilePath = path.join(userFolder, 'informations.json');

    // Écrire les informations utilisateur dans un fichier
    fs.writeFile(userFilePath, JSON.stringify(userData), (err) => {
        if (err) {
            console.error('Erreur lors de l\'écriture du fichier :', err);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la sauvegarde des informations utilisateur.'
            });
        } else {
            console.log('Informations utilisateur enregistrées avec succès.');
            res.status(200).json({
                success: true,
                message: 'Informations utilisateur enregistrées avec succès.'
            });
        }
    });
});

app.post('/data/user/params', (req, res) => {
    const userDataID = req.body.id;
    const filePath = './users/' + userDataID + '/parametres.json';

    if (fs.existsSync(filePath)) {
        // Lecture du fichier JSON
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                console.error('Erreur lors de la lecture du fichier:', err);
                res.status(500).json({
                    success: false,
                    message: 'Erreur lors de la lecture du fichier'
                });
            } else {
                const params = JSON.parse(data);
                console.log(params); // Utilisation des données lues depuis le fichier JSON
                res.status(200).json({
                    success: true,
                    message: 'Data found',
                    params: params
                });
            }
        });
    } else {
        res.status(200).json({
            success: true,
            message: 'Data not found',
            params: null
        });
    }
});

app.post('/data/user/params/write', (req, res) => {

    const userDataID = req.body.id;
    const userDataBG = req.body.background;

    console.log(userDataID);
    console.log(userDataBG);

    var parametresJSON = {
        "background": userDataBG
    }
    const userFolder = path.join(__dirname, 'users', JSON.stringify(userDataID));
    const userFilePath = path.join(userFolder, 'parametres.json');

    // Écrire les informations utilisateur dans un fichier
    fs.writeFile(userFilePath, JSON.stringify(parametresJSON), (err) => {
        if (err) {
            console.error('Erreur lors de l\'écriture du fichier :', err);
            res.status(500).json({
                success: false,
                message: 'Erreur lors de la sauvegarde des paramètres utilisateur.'
            });
        } else {
            console.log('Paramètres utilisateur enregistrées avec succès.');
            res.status(200).json({
                success: true,
                message: 'Paramètres utilisateur enregistrées avec succès.'
            });
        }
    });
});


// Écouter le port spécifié
app.listen(port, () => {
    console.log(`Serveur démarré sur le port ${port}`);
});