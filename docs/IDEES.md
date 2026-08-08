# Idées — Luma OS

Fichier vivant : suggestions d'applications, réglages et fonctionnalités pour Luma OS, avec une description courte et le niveau d'effort. Les idées cochées `[x]` sont faites ou engagées. Base : audit du code (apps, paramètres, shell, backend).

---

## Applications à créer

### 1. Visionneuse de PDF
- **Description** : ouvre les fichiers PDF de Documents (aperçu, zoom, saut de page, impression). Complète le Bloc-notes et la visionneuse d'images pour couvrir tous les formats.
- **Effort** : moyen (afficheur inline maison ou intégration d'une lib d'aperçu ; l'API `/api/documents/:id/download` existe déjà).
- **Bonus** : annotations simples, récents.

### 2. Galerie de photos (Photos Luma)
- **Description** : vraie galerie plein écran : grille chronologique, vue album, diaporama, métadonnées EXIF, favoris. L'app `image-viewer` actuelle est alpha et limitée à une image.
- **Effort** : moyen.
- **Bonus** : rotation, recadrage, glisser-déposer pour réorganiser.

### 3. Lecteur audio autonome (Bibliothèque musicale)
- **Description** : le `music-player` actuel ne lit qu'un fichier ouvert depuis Documents. Une bibliothèque musicale permettrait : liste des morceaux, albums, playlists locales, recherche, queue, égaliseur basique.
- **Effort** : moyen-élevé.
- **Bonus** : fond d'écran album en cours de lecture, mini-lecteur en barre des tâches (à la Harmonix).

### 4. Gestionnaire de fichiers
- **Description** : l'explorateur Documents sert à la fois de gestionnaire de fichiers. Un onglet « stockage » montrerait le quota, les types dominants, la corbeille, et un tri/dupliqués.
- **Effort** : moyen (repose sur l'API Documents existante).

### 5. App Météo
- **Description** : météo locale avec fond d'écran dynamique (ciel nuageux → paysage sombre). Nécessite une source de données — compatible avec l'isolation « aucune connexion externe » si elle passe par un proxy serveur.
- **Effort** : moyen.
- **Bonus** : widget sur le bureau, icône de la barre des tâches selon la météo.

### 6. Agenda/Planificateur enrichi
- **Description** : le Calendrier gère déjà des événements en `localStorage`. Le passer multi-vues (semaine, liste), rappels, récurrence, et synchroniser les événements côté serveur (`data/accounts`/SQLite) pour survivre à un changement d'appareil.
- **Effort** : moyen-élevé.

### 7. Bloc-notes enrichi (Notes LUMA)
- **Description** : le Bloc-notes est un éditeur Markdown avec aperçu. Ajouter : listes à puces cliquables, case à cocher, recherche dans les notes, dossiers de notes, épinglage.
- **Effort** : moyen.

### 8. Panneau d'administration / Tableau de bord LUMA
- **Description** : vue d'ensemble de l'écosystème (Kyros, Harmonix, Sonora, BrainDump, Documents) : statut, latence, sessions actives. Complète `luma-orbit` (catalogue) et `task-manager` (métriques machine).
- **Effort** : moyen.

### 11. App de flux RSS / Actualités LUMA
- **Description** : agrégateur de flux via proxy serveur (pour respecter l'isolation réseau). Fils par défaut configurables dans Paramètres.
- **Effort** : moyen.
- **Bonus** : fil « à lire plus tard ».

### 12. Traducteur / Dictionnaire
- **Description** : petit utilitaire hors-ligne (languettes de mots courants) ou via proxy serveur. Bon candidat pour tester un pipeline de petites apps utilitaires.
- **Effort** : faible-moyen.

### 13. Visualiseur Markdown / HTML dans Documents
- **Description** : avant de télécharger, prévisualiser un `.md` ou `.html` directement dans Documents (le rendu Markdown du Bloc-notes est réutilisable).
- **Effort** : faible.

### 14. App « Réseau Luma » interactive
- **Description** : la vue Réseau de Paramètres est en lecture seule. En faire une app dédiée : tester les connexions, voir les services joignables, relancer un proxy.
- **Effort** : moyen.

### 15. App Contact / Annuaire LUMA
- **Description** : carnets de contacts locaux (nom, email, liens), épinglables au bureau. Données en `localStorage` ou SQLite.
- **Effort** : faible-moyen.

---

## Paramètres à ajouter

### 16. Thème avancé
- **Description** : choisir le fond de verrouillage séparément du bureau ; régler l'opacité des fenêtres, l'arrondi des coins, la taille du texte ; mode « contraste élevé ».
- **Effort** : moyen.
- **Note** : l'UI propose déjà 13 fonds + 4 4K ; `luma-aurora.webp` est autorisé par le serveur mais absent de l'UI — à ajouter.
- **Statut** : 🚧 **Partiel** — le lock screen utilise désormais `luma-aurora.webp` plein écran (heure en haut, dernier user + logo LUMA au centre, réseau/batterie non cliquables en bas à droite). Reste à faire : fond de verrouillage choisi indépendamment du bureau, opacité/arrondi/taille de texte, contraste élevé, et ajout de `luma-aurora.webp` à la galerie Paramètres.

### 17. Barre des tâches : position et comportement
- **Description** : barre en bas/en haut, taille (petite/standard), masquage automatique, centrage des icônes, regroupement des fenêtres d'une même app.
- **Effort** : moyen.

### 18. Notifications
- **Description** : activer/désactiver par app, durée des toasts, son de notification, mode « ne pas déranger ».
- **Effort** : moyen.
- **Prérequis** : un vrai système de notifications (actuellement toasts temporaires).

### 19. Langue et région
- **Description** : le compte gère déjà `language`/`timeZone` côté serveur, mais l'interface n'est pas encore traduite. Appliquer `language` aux textes de l'UI.
- **Effort** : élevé (i18n de toutes les apps).
- **Note** : infrastructure serveur déjà prête.

### 20. Démarrage : apps au démarrage
- **Description** : le Gestionnaire des tâches propose déjà des apps au démarrage (`luma.startup-apps`). L'élever dans Paramètres avec un ordre et une attente entre chaque lancement.
- **Effort** : faible.

### 21. Compte : avatar et photo de profil
- **Description** : permettre de choisir une image locale pour l'avatar (actuellement initiale du nom). Stockage local ou serveur.
- **Effort** : faible-moyen.

### 22. Confidentialité
- **Description** : effacer l'historique (localStorage, session), exporter/importer ses paramètres, « réinitialiser le bureau ».
- **Effort** : faible-moyen.
- **Bonus** : mode invité sans persistance.

### 23. Sauvegarde
- **Description** : sauvegarder les paramètres et événements calendrier (export JSON), restauration sur un autre appareil.
- **Effort** : moyen.

### 24. Accessibilité
- **Description** : réduction de mouvement (déjà là), taille du curseur, son d'UI, raccourcis clavier personnalisables.
- **Effort** : moyen.

---

## Fonctionnalités transverses du shell

### 25. Sync multi-onglets des fenêtres
- **Description** : deux onglets du même bureau se partageraient les fenêtres ouvertes (via `BroadcastChannel`, comme Harmonix le fait déjà). Aujourd'hui chaque onglet a son propre gestionnaire.
- **Effort** : élevé.

### 26. Notifications système Luma
- **Description** : remplacer les toasts éphémères par un centre de notifications (icône barre des tâches, historique, actions), alimenté par les apps.
- **Effort** : moyen-élevé.

### 27. Presse-papiers partagé
- **Description** : historique du presse-papiers (texte, images), épinglable, réutilisable entre apps. Clavier `Ctrl/Cmd+Maj+V`.
- **Effort** : moyen.

### 28. Recherche globale (menu Démarrer)
- **Description** : la recherche actuelle filtre par nom d'app. L'étendre : fichiers Documents, notes, événements, paramètres, calculs rapides.
- **Effort** : moyen-élevé.

### 29. Widgets du bureau
- **Description** : horloge, météo, prochain événement, notes épinglées, stats — positionnables librement sur le fond d'écran.
- **Effort** : moyen.
- **Bonus** : thème du widget assorti à l'accent.

### 30. Multi-écrans
- **Description** : détecter les écrans (Screen Enumeration API) et permettre de déplacer une fenêtre sur un autre moniteur, fond d'écran par écran.
- **Effort** : élevé.

### 31. Zones de notification / volets
- **Description** : panneau latéral central (calendrier, notifications, réglages rapides : Wi-Fi virtuel, thème, volume) à la manière d'un centre de contrôle.
- **Effort** : moyen.

### 32. Gestion d'énergie virtuelle
- **Description** : écran de veille/verrouillage automatique après inactivité, action à la fermeture de la session (verrouiller vs déconnecter).
- **Effort** : faible-moyen.

### 34. Jeux d'icônes et thèmes visuels
- **Description** : packs d'icônes téléchargeables et thème du shell (teinte des surfaces, niveau de blur) en complément des accents.
- **Effort** : moyen.

### 35. Mode hors-ligne réel
- **Description** : le service worker met en cache le shell. Rendre le mode hors-ligne complet : liste d'apps disponibles sans réseau, message clair, données en cache. Aujourd'hui le shell exige l'API session.
- **Effort** : moyen-élevé.

### 36. Glisser-déposer entre apps
- **Description** : glisser un fichier de Documents vers le Bloc-notes, une image vers Paramètres (avatar/fond), un morceau vers le lecteur.
- **Effort** : moyen.

### 37. Raccourcis clavier configurables
- **Description** : centraliser les raccourcis (Ctrl/Cmd+K existe déjà) et les rendre personnalisables depuis Paramètres.
- **Effort** : moyen.

### 38. Assistants / commandes vocales
- **Description** : commande clavier « la barre de commandes » (à la Ctrl+Shift+P) pour exécuter des actions du système (ouvrir une app, changer de thème, vider la corbeille…).
- **Effort** : moyen.

---

## Nettoyage technique et dette

### 39. Aligner les registres d'applications
- **Description** : `data/apps.json` (5 apps serveur) vs `luma-shell.js` (15 apps front). Décider d'une source de vérité unique, ou du moins documenter le complément. Réparer les `entry` qui pointent vers des `.html` alors que le shell charge des `app.js`.
- **Effort** : faible-moyen.

### 42. Purger le code hérité
- **Description** : `app.js` (ancien serveur avec routes non sécurisées), `sources/assets/javascripts/all.js`, `jquery/`, `window/*.js`, `start-locked/`, `notifications-horloge-date-start-menu/`, CSS `allstyles.css`, `window.css`, `start-menu.css`, `TEST/`, `users/`, `sources/apps/desktop/` — tous non chargés par `index.html`.
- **Effort** : moyen (à faire avec git, par couches).

### 43. Retirer l'exception CSP `cdn.jsdelivr.net`
- **Description** : `script-src` autorise `'unsafe-inline'` et `cdn.jsdelivr.net` (héritage Axios). Retirer une fois le code hérité purgé.
- **Effort** : faible.

### 44. Magasin de session persistant
- **Description** : `express-session` utilise `memorystore` (perdu au redémarrage). Passer à SQLite pour des sessions persistantes en production.
- **Effort** : moyen.

### 45. Écrans de verrouillage dédoublonnés
- **Description** : `session-select/` ET `renderSessionScreen` dans `luma-shell.js` font la même chose. Fusionner en un seul rendu.
- **Effort** : faible-moyen.

### 46. Couverture de tests
- **Description** : les apps frontend (Terminal, Calendrier, Paramètres UI) n'ont pas de tests unitaires. Ajouter des suites minimales (pur JS) et étendre le visual-check.
- **Effort** : moyen.

### 47. Volume séparé audio/vidéo
- **Description** : `music-player` et `video-player` partagent `luma.music.volume`. Séparer les réglages.
- **Effort** : faible.

---

## Easter eggs et personnalité

### 49. Easter eggs
- **Description** : étendre la mécanique du Terminal (`sudo reboot` → Matheo Systems, documentée dans `docs/ARCHITECTURE.md`) : commandes secrètes, réponses humoristiques (`sudo`, `banana`, `hack`, `matrix`, `42`), bruitages, fond secret. Idées : taper `help --all` pour révéler une commande cachée, séquence clavier Konami sur le bureau.
- **Effort** : faible.


---

## Prioritaires (recommandation)

3. **#16 + #48 Fonds/thème avancé** (faible-moyen) — impact visuel immédiat.
4. **#1 Visionneuse PDF** (moyen) — comble le format manquant le plus courant.
5. **#19 Langue de l'UI** (élevé) — infra serveur déjà prête, gros gain.
6. **#27 Presse-papiers partagé** (moyen) — fonctionnalité différenciante et concrète.
7. **#28 Recherche globale** (moyen-élevé) — transforme le menu Démarrer.
