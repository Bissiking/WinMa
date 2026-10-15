# Audit technique de Luma OS

Date de l'audit : 5 août 2026  
Périmètre : dépôt historique WinMa, désormais nommé publiquement Luma OS, brief de refonte et contrat Kyros décrit dans `API.md`.  
Méthode : lecture statique de l'ensemble du code applicatif, inspection des dépendances et exécution de `npm audit`. Aucun code applicatif n'a été modifié pendant cette phase.

## Résumé exécutif

WinMa est un prototype de bureau web servi par un unique serveur Express. Le concept principal est déjà visible : écran verrouillé, bureau, barre des tâches, menu principal, applications HTML chargées dynamiquement et fenêtres déplaçables. L'implémentation reste cependant monolithique et plusieurs fonctions affichées sont partielles ou simulées.

Les trois risques prioritaires sont :

1. l'ancienne connexion envoie le mot de passe vers une URL codée en dur puis conserve toute la réponse utilisateur dans `localStorage` et sur disque ;
2. les routes de données acceptent un identifiant fourni par le navigateur et l'utilisent dans des chemins de fichiers sans authentification ni validation ;
3. le gestionnaire de fenêtres n'a pas d'état central et agit parfois sur la première fenêtre du document, ce qui rend le multi-fenêtrage incorrect.

Le nouveau contrat Kyros change le modèle de connexion : WinMa doit utiliser le SSO par code d'autorisation. Le navigateur est redirigé vers l'interface Kyros ; le backend WinMa échange le code, garde les tokens côté serveur et ne remet au frontend qu'un profil minimal via une session protégée.

## Fonctionnement actuel

### Démarrage et rendu

- `app.js` démarre Express sur le port fixe `3000`.
- `index.html` est servi à la racine et `sources/` est exposé comme répertoire statique.
- `sources/assets/javascripts/all.js` décide, à partir de `localStorage.UserData`, d'afficher le bureau ou l'écran de connexion.
- Les fragments d'applications sont récupérés avec jQuery puis injectés avec `.html()`.
- Les fenêtres sont créées dynamiquement dans `open-close.js` et ajoutées directement au `<body>`.

### Connexion actuelle

- Le fragment `session-select` affiche un formulaire identifiant/mot de passe.
- Le navigateur appelle directement `https://dev.mhemery.fr/api/login`.
- La réponse complète `dataUser` est envoyée à `/data/write/user`, écrite dans `users/<id>/informations.json`, puis copiée dans `localStorage`.
- La présence de cette entrée locale est considérée comme une session valide ; aucune vérification serveur n'est faite au chargement.
- Le verrouillage supprime uniquement `localStorage.UserData`.

Ce fonctionnement doit être retiré lors de la phase d'authentification Kyros, après mise en place des routes de remplacement.

### Paramètres

- Le fond d'écran est lu par `POST /data/user/params` à partir d'un identifiant transmis par le client.
- Une sélection dans l'application Paramètres appelle `POST /data/user/params/write`.
- L'écriture remplace le document entier par `{ "background": ... }`.

### Applications et fenêtres

- Paramètres est une application HTML interne.
- Navigateur et Jellyfin sont des iframes dont les URLs sont écrites dans les fragments HTML.
- Le bureau affiche Corbeille et Documents, sans libellé ni action.
- Chaque ouverture crée un nouvel élément `.window` de `800 × 600 px`.
- Le déplacement existe à la souris. La fermeture existe. Un agrandissement partiel existe.
- Le redimensionnement manuel est commenté et son implémentation actuelle est défectueuse.

## Inventaire des fonctionnalités

| Fonction | État | Observation |
| --- | --- | --- |
| Serveur de fichiers Express | Fonctionnel | Configuration monolithique et port fixe |
| Écran de connexion | Partiel | Ancienne API, délais artificiels, état d'erreur cassé |
| Bureau | Partiel | Deux icônes décoratives uniquement |
| Barre des tâches | Partiel | Bouton, deux raccourcis, horloge et notification décorative |
| Menu principal | Partiel | Ouverture/fermeture, liste statique ; recherche désactivée |
| Horloge/date | Fonctionnel | Mise à jour chaque seconde |
| Chargement d'applications | Partiel | Injection HTML sans registre ni contrôle central |
| Multi-fenêtrage | Partiel | Plusieurs éléments possibles, états non indépendants |
| Déplacement de fenêtre | Partiel | Souris seulement et dépendance à un `<section>` global |
| Fermeture de fenêtre | Fonctionnel | Suppression DOM, sans synchronisation de barre des tâches |
| Maximisation/restauration | Défectueux | État global et première fenêtre ciblée |
| Minimisation | Absente | Aucun modèle ni contrôle |
| Redimensionnement | Désactivé | Code commenté et cible incorrecte pendant le mouvement |
| Paramètres de fond | Partiel | Écriture non fusionnée, contrôle d'accès absent |
| Thème et accent | Absents | Demandés dans le brief |
| Session sécurisée | Absente | `localStorage` fait foi |
| Notifications | Décoratif | Icône sans comportement |
| Responsive tactile | Absent | Tailles fixes, événements souris uniquement |
| Navigation clavier | Absente | Actions principales sur images et `onclick` |

## Bugs et fragilités

### Priorité critique

- Une erreur réseau masque définitivement `#BtnConnexionWinMa` au lieu de le restaurer.
- L'identifiant de l'utilisateur est concaténé dans `./users/<id>/parametres.json` ; une valeur telle que `../../...` peut sortir du répertoire prévu.
- Toute personne peut lire ou écraser les paramètres d'un autre utilisateur en envoyant son identifiant, car aucune route n'est authentifiée.
- `fs.writeFile` peut être appelé alors que le dossier utilisateur n'existe pas dans `/data/user/params/write`.

### Priorité haute

- `ajusterTailleImage()` cible `document.querySelector('.window')`, donc la première fenêtre, pas celle dont le bouton a été utilisé.
- `estGrossi` est global : toutes les fenêtres partagent le même état d'agrandissement.
- Restaurer une fenêtre impose `800 × 600 px` et perd sa position et ses dimensions précédentes.
- Le déplacement calcule ses limites depuis le premier élément `<section>`, qui varie selon le fragment chargé et peut être absent.
- Une fenêtre de `800 × 600 px` dépasse sur les écrans étroits.
- La hauteur `.window-content: 100%` s'ajoute à celle de l'en-tête et provoque un débordement.
- Le bouton d'agrandissement est ajouté après le bouton de fermeture et la hiérarchie de contrôles est incohérente.
- Les nouveaux fragments peuvent réexécuter leurs scripts et multiplier les écouteurs ou les variables globales.
- Les appels Axios des paramètres n'ont pas de gestion d'erreur.

### Priorité moyenne

- Le menu ne se ferme ni au clic extérieur, ni avec Échap, ni après ouverture d'une application.
- Le menu d'alimentation ne distingue pas verrouillage, changement d'utilisateur et déconnexion.
- Les fenêtres n'ont ni focus actif, ni z-index géré, ni entrée dans la barre des tâches.
- `CallApps()` et `CallPage()` dupliquent la logique de chargement.
- La création d'identifiants par timestamp et nombre aléatoire n'offre pas de garantie formelle d'unicité.
- De nombreux sélecteurs CSS globaux (`section`, `input`) créent des collisions entre applications.
- La locale HTML est `en` alors que l'interface est en français.
- Des textes et noms sont incohérents (`LumaVigateur`, « menu démarré », `Unknown`, `NO USERS`).

## Risques de sécurité

### Identité et session

- Le mot de passe transite dans le JavaScript WinMa et vers une origine externe codée en dur.
- La réponse complète de l'API peut contenir des données inutiles ou sensibles et est persistée sans filtrage.
- `localStorage` est lisible par tout script exécuté sur l'origine ; sa présence est assimilée à une authentification.
- La « déconnexion » ne révoque aucun jeton et ne détruit aucune session serveur.
- Aucun contrôle CSRF, `state` OAuth, rotation de session ou expiration applicative n'existe.

### API et fichiers

- Les routes `/data/*` sont publiques.
- Les corps de requête n'ont ni schéma, ni limite explicite, ni normalisation.
- La construction des chemins depuis `req.body.id` permet une traversée de répertoires.
- L'écriture de l'objet utilisateur complet contrevient au principe de minimisation.
- Les erreurs JSON asynchrones et les exceptions de `JSON.parse` ne sont pas centralisées.
- Les logs peuvent exposer identifiants, paramètres et réponses externes.

### Navigateur

- Axios est chargé depuis un CDN sans intégrité de sous-ressource ; une copie locale ou `fetch` natif est préférable.
- Les iframes sont déclarées sans registre d'autorisation, `sandbox`, politique de permissions ni vérification de compatibilité `frame-ancestors`.
- L'injection de fragments HTML avec `.html()` élargit l'impact d'un contenu compromis.
- Aucun en-tête Helmet, CSP, protection contre le framing ou politique de référent n'est configuré.

### Dépendances

`npm audit` signale 11 vulnérabilités dans l'arbre installé : 7 hautes, 1 modérée et 3 faibles. Elles concernent notamment Express 4.19.2 et ses dépendances (`body-parser`, `path-to-regexp`, `qs`, `send`, `serve-static`) ainsi que des dépendances transitives de l'outillage. Une mise à jour contrôlée du verrou est requise avant exposition réseau.

Le paquet npm `path` est inutile : `path` fait partie de Node.js. `nodemon` devrait être une dépendance de développement.

## UX, accessibilité et responsive

- Plusieurs actions sont portées par des `<img>` sans bouton, nom accessible ou état de focus.
- Le formulaire n'a pas de `<label>`, pas d'envoi natif, pas d'annonce d'erreur et pas d'affichage du mot de passe.
- `user-select: none` est appliqué à toute l'application, y compris aux contenus qui devraient rester copiables.
- Les images Paramètres ont des alternatives génériques et l'aperçu a un `alt` vide sans justification.
- Les interactions de déplacement et redimensionnement ne prennent pas en charge Pointer Events ni le tactile.
- Le menu de `650 × 700 px`, les fenêtres de `800 × 600 px` et plusieurs largeurs fixes ne s'adaptent pas aux petits écrans.
- Aucun traitement de `prefers-reduced-motion`, du contraste forcé ou du zoom texte n'est présent.

## Éléments à préserver pendant la migration

- Le concept de bureau web LUMA et l'ouverture d'applications dans des fenêtres.
- Les applications Paramètres, Navigateur et Jellyfin, avec un mode de chargement sécurisé adapté à chacune.
- Les fonds d'écran existants et les icônes LUMA tant qu'ils ne sont pas remplacés par des actifs approuvés.
- Le déplacement, la fermeture, l'agrandissement et le multi-fenêtrage, réimplémentés derrière une API d'état cohérente.
- La barre des tâches, le menu principal, l'horloge et les actions de session.

## Décisions encore ouvertes

- Identifiant, audience, scopes, callback et domaines de l'application Luma OS dans l'administration Kyros.
- Stockage de session de production et politique de révocation Kyros disponible.
- Liste des services externes autorisés à être intégrés dans une iframe.
- Niveau d'accessibilité cible au-delà du socle WCAG 2.2 AA recommandé.
