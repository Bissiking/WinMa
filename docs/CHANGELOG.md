# Journal des versions (Changelog)

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/) : chaque version expose un **survol** (rapide et court, à survoler) puis une section **détails** complète. Les versions marquées `alpha` sont des jalons internes ; seules les versions stables reçoivent un numéro public sans suffixe.

## 3.1.0 — Survol

> Nouveautés en une minute.

- **Lecteurs intégrés** : les fichiers audio (mp3, wav…) et vidéo (mp4…) s'ouvrent désormais dans des applications dédiées au lieu d'être téléchargés.
- **Nouvelles applications** : Calculatrice, Terminal et Calendrier rejoignent le bureau LUMA.
- **Barre des tâches refondue** : applications permanentes (épinglées), icônes seules, réorganisation par glisser-déposer, état « en cours d'exécution » distinct de l'état actif.
- **Menus contextuels** : clic droit sur la barre des tâches (attacher/détacher, ouvrir, fermer) et sur le bureau (fond d'écran, création de dossier, ouvrir un raccourci).
- **Luma Orbit enrichi** : fiche produit par application, installation/désinstallation, suppression du label « Catalogue de démonstration » et de l'entrée Kyros.
- **Documents** : filtre par type (Images, Vidéos, Musique, Documents) et accès rapide latéral.
- **Horloge** : un clic ouvre directement le Calendrier.
- **Technique** : index de référence `docs/INDEX.md`, indicateur d'exécution propre dans la barre des tâches, tests visuels étendus.
- **Session persistant** : la réactualisation est bloquée (`F5`, `Ctrl/Cmd+R`) et vos fenêtres ouvertes sont restaurées automatiquement après un rechargement.
- **Démarrage réel** : le lancement affiche « Réouverture de vos applications récemment ouvertes », les ressources sont mises en cache (service worker) pour un démarrage plus rapide.
- **Paramètres façon Windows** : page d'accueil avec cartes de catégories, et nouveau réglage « Démarrage » pour activer ou désactiver la réouverture automatique.

---

## 3.1.0 — Détails

### Ajouts

- Sauvegarde de session multi-appareils : les fenêtres ouvertes (application, document, position, état réduit/agrandi) sont persistées en base SQLite (`window_sessions`, clé = utilisateur Kyros) à chaque changement et restaurées au boot — y compris depuis un autre navigateur — avec timeout de recherche de 1,5 s puis repli sur la copie `localStorage`.
- Sauvegarde de session : les fenêtres ouvertes (application, document, position, état réduit/agrandi) sont persistées dans `localStorage` à chaque changement et restaurées automatiquement au prochain chargement.
- Blocage de la réactualisation : `F5` et `Ctrl/Cmd+R` sont désactivés sur le bureau (vos fenêtres restent ouvertes) ; en dernier recours, un rechargement externe (bouton navigateur) restaure quand même toutes les fenêtres.
- Démarrage : le statut « Réouverture de vos applications récemment ouvertes » apparaît pendant le boot quand une session est à restaurer ; `service worker` (`sources/sw.js`) met en cache les ressources statiques pour accélérer les lancements suivants.
- Paramètres : nouvelle page d'accueil avec cartes de catégories, nouvelle catégorie « Démarrage » avec l'option `restoreSession` (paramètre serveur, booléen) pour activer/désactiver la réouverture automatique.

**Applications**

- **Calculatrice** (`sources/apps/calculator/`) : mode standard, saisie clavier et souris, opérateurs enchaînés.
- **Terminal** (`sources/apps/terminal/`) : console sombre, historique des commandes (↑/↓), commandes `help`, `about`, `date`, `echo`, `clear`, `apps`, `ps`, `open`, `close`, `luma`, `exit` ; `exit` ferme la fenêtre.
- **Calendrier** (`sources/apps/calendar/`) : vue mensuelle, événements persistés dans `localStorage["luma.calendar.events"]`, dialogue d'ajout, bouton « Aujourd'hui ».
- **Lecteur de musique** (`sources/apps/music-player/`) : pochette, lecture/pause, barre de progression cliquable, volume persisté (`luma.music.volume`), téléchargement, état d'erreur.
- **Lecteur vidéo** (`sources/apps/video-player/`) : vue 16:9 sombre, lecture au clic, contrôle lecture/pause, seek, volume, temps formaté, téléchargement, état d'erreur.
- **Alimentation** (`sources/apps/power/`) : état de batterie réel via la Battery API (niveau, charge/décharge, temps restant), jauges visuelles, notifications sur changement d'alimentation et niveau faible, état de repli si l'API est indisponible.
- **Minuteur** (`sources/apps/timer/`) : minuteur avec présélections pomodoro / pause courte / pause longue, chronomètre avec tours, alerte sonore (Web Audio) et notification Luma à la fin d'un minuteur.
- Enregistrement complet des nouvelles applications : registre du shell, icônes, dégradés, sprite SVG, liens CSS.

**Barre des tâches**

- Indicateur d'alimentation à gauche de l'horloge : icône batterie + pourcentage en décharge, icône prise en secteur, alerte orange sous 20 %, clic ouvrant l'app Alimentation (Battery API, masqué si indisponible).
- Cache du service worker passé à `luma-shell-v3` : purge du cache v2 qui servait encore l'ancien `luma-shell.js` (Navigateur LUMA et Jellyfin visibles au menu Démarrer malgré leur suppression).
- Applications permanentes épinglées par défaut : Documents, Calendrier, Gestionnaire des tâches, Terminal ; ordre et présence persistés dans `localStorage["luma.taskbar.pinned"]`.
- Layout forcé en icônes uniquement.
- Réorganisation par glisser-déposer avec seuil de 8 px et garde anti-clic après le glisser.
- Épingler/détacher depuis le menu contextuel, avec transfert propre du bouton d'une fenêtre ouverte.
- Indicateur d'exécution : `is-running` (app ouverte) distinct de `is-active` (fenêtre au premier plan) ; plus aucun point orphelin ni barre fantôme sur les simples raccourcis.
- Clic délégant unique corrigeant l'accumulation de listeners (double bascule).

**Menus contextuels**

- Nouveau module partagé `sources/assets/javascripts/luma-context-menu.js` (ouverture à une position, séparateurs, actions, fermeture par clic extérieur / Échap / redimensionnement).
- Barre des tâches : Ouvrir, Fermer la fenêtre, Épingler / Détacher.
- Bureau : « Personnaliser le fond d'écran » (ouvre Paramètres), « Créer un dossier » (POST `/api/documents/folders`), « Ouvrir X » sur un raccourci.

**Luma Orbit**

- Catalogue à 5 applications : Nino, BrainDump, Harmonix, Sonora Studio, A.R.C. (entrée Kyros retirée).
- Fiche produit par application : icône, catégorie, statut, bouton d'installation, description longue, panneau « Détails » (écosystème, catégorie, disponibilité, identité).
- Installation et **désinstallation** (bouton corbeille dans la liste et dans la fiche) ; l'app disparaît du menu Démarrer.
- Navigation clavier (Entrée / Espace) et responsive : fiche en une colonne, hero empilé sous 520 px.
- Badge « Catalogue de démonstration » retiré ; statut « Installé » en lieu et place d'« Ajoutée au prototype ».

**Documents**

- Filtre backend par type (`type` dans `GET /api/documents`) : `image`, `video`, `audio`, `document` ; validation `DOCUMENT_TYPE_INVALID` en 400.
- Sidebar « Accès rapide » : Mes fichiers, Images, Vidéos, Musique, Documents, Corbeille ; réinitialisation du filtre sur navigation/recherche.
- Ouverture des fichiers audio et vidéo dans les nouveaux lecteurs au double-clic.

**Horloge**

- Un clic sur l'horloge de la barre des tâches ouvre le Calendrier.

**Terminal**

- Commande secrète `sudo reboot` : ouvre **Matheo Systems** (easter egg). L'application est désormais masquée du menu Démarrer (`hidden: true` dans le registre du shell) mais reste lançable par cette commande.

**Isolation externe**

- **Navigateur LUMA et Jellyfin retirés** : plus aucune connexion externe n'est possible depuis le bureau. Suppression des entrées `browser`/`jellyfin` du registre serveur (`data/apps.json`), du registre du shell, de l'hôte iframe `web-frame/`, des pages `navigateur/` et `jellyfin/`, de leurs autorisations CSP `frame-src` et du test associé.

**Personnalité**

- Écran de verrouillage redessiné façon OS : fond `luma-aurora.webp` plein écran, heure et date en haut, logo `luma-os-logo.svg` + « Luma OS » au centre, bouton de connexion Kyros, dernier utilisateur connecté (avatar + nom, persisté dans `localStorage["luma.last-user"]`) en bas à gauche, et barre d'état en bas à droite (réseau + batterie/prise, non cliquables, Battery API).
- Messages de bienvenue contextuels : module `sources/assets/javascripts/luma-welcome.js` (phrase choisie selon l'heure et le thème), affiché sur l'écran de verrouillage (`renderSessionScreen`) et dans la bannière de démarrage du Terminal.

**Technique et documentation**

- `docs/INDEX.md` : index technique (arborescence, routes, contrôleurs, services, middlewares, repository, shell, applications, tests, scripts).
- `docs/ARCHITECTURE.md` : section « Easter eggs » documentant le déclencheur `sudo reboot` et la marche à suivre pour en ajouter d'autres.
- `scripts/visual-check.mjs` : couverture des apps épinglées, fiches Orbit, installation/désinstallation, lecteurs audio et vidéo ; captures desktop et mobile.

### Modifications

- `sources/apps/documents/app.js` : routage des MIME audio (`audio/*`, extensions mp3/wav/ogg/…) et vidéo (`video/*`, extensions mp4/m4v/webm/…) vers les lecteurs.
- `sources/apps/terminal/app.js` : liste des applications alignée sur le registre réel du shell (via `context.registry`, plus d'`AVAILABLE_IDS` fantômes `gallery, remote, text, keyboard…`) ; saisie déplacée dans la zone de sortie (input inline à la ligne de prompt, plus de champ séparé en bas).
- `sources/assets/css/luma-shell.css` : styles des menus contextuels, glisser-déposer de la barre des tâches, indicateurs `is-running` / `is-active`, dégradés des nouvelles icônes.
- `sources/assets/javascripts/luma-shell.js` : import du menu contextuel, menu du bureau, création de dossier, ouverture du calendrier à l'horloge, nouvelle icône `music`/`video`.
- `sources/assets/javascripts/luma-window-manager.js` : apps épinglées, drag & drop, `pin`/`unpin`, `syncWindowTaskState`, `refreshRunningState`, menu contextuel, listener délégant.
- `index.html` : symboles sprite `icon-calc`, `icon-terminal`, `icon-download`, `icon-video`, liens CSS des nouvelles applications.
- `src/server/services/document-service.js` et `src/server/repositories/sqlite-document-repository.js` : filtre de type validé et appliqué en SQL.
- Versions uniformisées sur `3.1.0` : source de vérité `package.json` servie par `/api/health`, propagée par `systemVersion` (shell) puis `version` dans le context des apps (window-manager) ; Terminal et Paramètres affichent la version serveur au lieu de valeurs codées en dur.
- Sauvegarde de session multi-appareils : table `window_sessions` en SQLite (`data/luma.sqlite`), endpoints `GET/PUT/DELETE /api/users/me/windows` clé par utilisateur Kyros (même-origine + session requise), synchro serveur debouncée (600 ms) sur chaque changement de fenêtres, restauration au boot avec timeout 1,5 s puis repli `localStorage`. Fichiers : `src/server/repositories/sqlite-session-repository.js`, `src/server/services/window-session-service.js`, `src/server/controllers/window-session-controller.js`, `src/server/routes/window-session-routes.js`.

### Correctifs

- Disparition des indicateurs fantômes dans la barre des tâches : les points épinglés et la barre jaune ne s'affichent plus sur des raccourcis non ouverts.
- Correction de l'accumulation des listeners par fenêtre qui causait une double bascule d'état.
- Correction du sélecteur `.orbit-row > button` devenu `.orbit-row__actions > button` après regroupement des actions.
- Lecture des fichiers audio et vidéo : ajout de la directive CSP `media-src 'self' blob:` qui bloquait les sources `URL.createObjectURL` (défaut `default-src 'self'`).
- Crash natif au démarrage sous Node 24 : passage de `better-sqlite3@^11.10.0` à `better-sqlite3@^12.11.1` (compatible Node 20–26, assertion `(env) != nullptr` résolue).

### Dépendances et scripts

- `npm run test` : 31 tests unitaires (7 pour Documents avec le filtre de type).
- `npm run test:visual` : vérifications Playwright desktop et mobile.

---

## 3.0.0-alpha.4 — Survol

> Version de stabilisation : SSO, session et fondations serveur documentées.

### Détails

- Authentification SSO Kyros par code d'autorisation (Phase 3 de la roadmap).
- Session serveur, renouvellement avec rotation atomique du refresh token, révocation au logout.
- Écran de verrouillage « Se connecter avec Kyros » remplaçant le formulaire de mot de passe.
- Paramètres : fond d'écran, thème, accent, densité, mouvement ; compte et quota Documents.
- API Documents : création, import, téléchargement, renommage, déplacement, recherche, corbeille.
- Tests unitaires et d'intégration avec faux fournisseur Kyros.
