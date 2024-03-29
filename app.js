const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;

if (!fs.existsSync('users')) {
    fs.mkdirSync('users', { recursive: true });
}

// Middleware pour le corps de la demande
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Définir le répertoire des fichiers statiques (comme les fichiers HTML, CSS, etc.)
app.use(express.static(path.join(__dirname, 'sources')));

// Route pour la page d'accueil
app.get('/', (req, res) => {
    // Envoyer le fichier index.html
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/data/write/user', (req, res) => {
    const userData = req.body;

    console.log(userData);

    // res.json(req.body);

    // Créer un dossier avec l'ID de l'utilisateur
    const userFolder = path.join(__dirname, 'users', JSON.stringify(userData.id));
    fs.mkdirSync(userFolder, { recursive: true });

    // Chemin du fichier utilisateur
    const userFilePath = path.join(userFolder, 'informations.json');

    // Écrire les informations utilisateur dans un fichier
    fs.writeFile(userFilePath, JSON.stringify(userData), (err) => {
        if (err) {
            console.error('Erreur lors de l\'écriture du fichier :', err);
            res.status(500).json({ success: false, message: 'Erreur lors de la sauvegarde des informations utilisateur.' });
        } else {
            console.log('Informations utilisateur enregistrées avec succès.');
            res.status(200).json({ success: true, message: 'Informations utilisateur enregistrées avec succès.' });
        }        
    });
});

app.post('/data/user/params', (req, res) => {
    const userDataID = req.body.id;
    console.log(userDataID);
    if(fs.existsSync('./users/'+userDataID+'/parametres.json')){
        const params = require('./users/'+userDataID+'/parametres.json');
        res.status(200).json({ success: true, message: 'data found', params: params });
    }else{
        res.status(200).json({ success: true, message: 'data not found', params: null });
    }
});

// Écouter le port spécifié
app.listen(port, () => {
    console.log(`Serveur démarré sur le port ${port}`);
});
