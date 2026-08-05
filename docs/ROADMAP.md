# Roadmap de migration vers Luma OS

Cette roadmap privilégie des incréments exécutables. Chaque phase se termine par des tests et un point de retour clair ; aucune fonctionnalité opérationnelle n'est remplacée par une maquette vide.

## Phase 1 — Audit et décisions produit

État : audit technique terminé.

Livrables :

- `docs/AUDIT.md` ;
- `docs/ARCHITECTURE.md` ;
- `docs/ROADMAP.md`.

Avant la refonte visuelle, confirmer :

- l'utilisateur principal et son contexte d'usage ;
- l'application Kyros (`client_id`, audience, scopes, callback, domaines) ;
- les services externes réellement autorisés ;
- la cible de déploiement et le magasin de session disponible.

Critère de sortie : architecture et contrat Kyros approuvés, fiche produit créée, aucun secret ajouté au dépôt. Le nom public est confirmé : Luma OS. Le projet est personnel et expérimental.

## Phase 2 — Fondations serveur

État : implémentée dans la première tranche, avec frontend historique conservé.

Objectif : mettre en place une base Express testable sans basculer le frontend historique.

Travaux :

1. séparer construction de l'application et écoute réseau ;
2. valider les variables d'environnement au démarrage ;
3. ajouter Helmet, limites de requête, journalisation sûre et gestion centralisée des erreurs ;
4. normaliser les enveloppes JSON ;
5. créer le registre des applications et sa validation ;
6. mettre à niveau les dépendances et déplacer `nodemon` en développement ;
7. ajouter des tests Node pour santé, erreurs et registre.

Critère de sortie : `npm test` passe, `npm audit` ne contient plus de vulnérabilité haute connue dans les dépendances de production et l'ancien bureau est toujours servi.

Retour arrière : `npm start` peut encore cibler l'ancien `app.js` jusqu'au changement explicite du script.

## Phase 3 — SSO Kyros et session

État : implémentation et tests automatisés terminés ; activation réelle en attente de l'application Luma OS dans Kyros.

Objectif : supprimer la collecte du mot de passe et faire de la session serveur la source de vérité.

Travaux :

1. créer `/auth/login` avec `state` aléatoire et redirection Kyros ;
2. créer `/auth/callback` avec validation de `state`, échange du code et rotation de session ;
3. conserver les tokens seulement dans le magasin serveur ;
4. créer `/api/session` et `/api/auth/logout` ;
5. implémenter le renouvellement avec rotation atomique du refresh token ;
6. remplacer le formulaire par un écran de verrouillage et un bouton « Se connecter avec Kyros » ;
7. retirer toute lecture/écriture de `localStorage.UserData` ;
8. tester callback valide, `state` invalide, code rejeté, session expirée, refresh et logout.

Critère de sortie : aucun mot de passe ou token Kyros n'est visible dans le frontend, le stockage navigateur, les URLs finales ou les logs.

Dépendance externe : l'application WinMa doit être créée et configurée dans Kyros. Les tests réels restent bloqués tant que ses valeurs ne sont pas fournies ; les tests HTTP utilisent un faux serveur Kyros local.

## Phase 4 — Système visuel et shell du bureau

Objectif : créer l'identité LUMA propre sans copier Windows 11.

Travaux :

1. établir la fiche produit et faire approuver une direction visuelle ;
2. créer les tokens de couleur, typographie, espace, rayon, ombre et mouvement ;
3. reconstruire le shell sémantique : verrouillage, bureau, barre des tâches et menu ;
4. rendre la recherche d'applications fonctionnelle ;
5. gérer clic extérieur, Échap, focus et annonces d'état ;
6. adapter tablette et mobile ;
7. vérifier WCAG 2.2 AA, zoom, contraste et mouvement réduit.

Critère de sortie : parcours session → bureau → recherche → ouverture d'application utilisable au clavier, à la souris et au tactile.

## Phase 5 — Gestionnaire de fenêtres

Objectif : obtenir plusieurs fenêtres réellement indépendantes.

Travaux :

1. créer le modèle d'état et les opérations du gestionnaire ;
2. rendre focus, profondeur et fenêtre active déterministes ;
3. implémenter déplacement avec Pointer Events et limites du bureau ;
4. implémenter redimensionnement avec minimums ;
5. ajouter minimisation, maximisation, restauration et double-clic d'en-tête ;
6. synchroniser la barre des tâches ;
7. passer automatiquement en plein écran sur petit écran ;
8. tester les transitions d'état indépendamment du DOM.

Critère de sortie : au moins trois fenêtres peuvent être ouvertes et manipulées sans partager position, taille ou statut.

## Phase 6 — Paramètres et personnalisation

Objectif : fournir une application Paramètres réelle et persistante.

Travaux :

1. migrer les fonds existants vers le nouveau catalogue ;
2. créer `GET` et `PATCH /api/users/me/settings` ;
3. valider et fusionner `wallpaper`, `theme` et `accentColor` ;
4. garantir l'écriture atomique et isolée par sujet Kyros ;
5. appliquer les changements immédiatement avec retour visuel et gestion d'erreur ;
6. ajouter thème clair, sombre et système ;
7. tester lecture, patch partiel, valeur refusée et fichier corrompu.

Critère de sortie : modifier l'accent ne réinitialise pas le fond ou le thème, et un compte ne peut ni lire ni modifier les réglages d'un autre.

## Phase 7 — Applications et services LUMA

Objectif : généraliser le registre et préparer la console de services.

Travaux :

1. migrer Paramètres, Navigateur et Jellyfin vers le registre ;
2. imposer une allowlist et une sandbox aux iframes ;
3. gérer proprement les applications externes ;
4. créer l'application Services avec données de démonstration explicitement indiquées ;
5. exposer uniquement des routes backend de lecture ;
6. définir permissions et confirmation avant toute future action sensible.

Critère de sortie : aucune URL ou commande de service n'est exécutée depuis une valeur arbitraire fournie au frontend.

## Phase 8 — Documentation, migration des données et livraison

Travaux :

1. écrire `README.md` et `docs/MIGRATION.md` ;
2. migrer uniquement les paramètres utiles des anciens dossiers `users/` ;
3. ne jamais migrer un mot de passe, hash ou token ;
4. ajouter tests de parcours, audit de sécurité, vérification responsive et contrôle accessibilité ;
5. basculer les scripts npm vers le nouveau serveur ;
6. retirer l'architecture historique dans un commit séparé et réversible.

Critère de sortie : installation reproductible, configuration documentée, secrets absents de Git et suite de tests verte.

## Première tranche exacte de fichiers

La prochaine tranche doit rester limitée aux fondations et au SSO. Elle ne déplace pas encore les images ou applications historiques.

### À créer

| Ordre | Fichier | Responsabilité |
| --- | --- | --- |
| 1 | `PRODUCT.md` | Vérité produit confirmée avant la refonte UI |
| 2 | `.env.example` | Variables sans valeurs sensibles |
| 3 | `src/server/config/env.js` | Lecture et validation de l'environnement |
| 4 | `src/server/config/security.js` | Options Helmet, cookies et limites |
| 5 | `src/server/utils/api-response.js` | Enveloppes JSON cohérentes |
| 6 | `src/server/utils/async-handler.js` | Propagation des erreurs async |
| 7 | `src/server/utils/logger.js` | Logs structurés et expurgés |
| 8 | `src/server/middlewares/error-handler.js` | Réponse d'erreur unique |
| 9 | `src/server/middlewares/not-found.js` | Gestion des routes absentes |
| 10 | `src/server/middlewares/require-session.js` | Protection des API privées |
| 11 | `src/server/services/kyros-service.js` | Construction authorize, échange et refresh |
| 12 | `src/server/services/session-service.js` | Profil minimal et cycle de session |
| 13 | `src/server/controllers/auth-controller.js` | Login, callback et logout |
| 14 | `src/server/controllers/session-controller.js` | État de session public minimal |
| 15 | `src/server/routes/auth-routes.js` | Routes `/auth/*` et logout |
| 16 | `src/server/routes/session-routes.js` | Route `/api/session` |
| 17 | `src/server/routes/api.js` | Agrégation des routes API |
| 18 | `src/server/app.js` | Fabrique Express testable |
| 19 | `src/server/server.js` | Point d'entrée réseau |
| 20 | `tests/helpers/fake-kyros.js` | Double HTTP local de Kyros |
| 21 | `tests/integration/auth.test.js` | Cas SSO et sécurité de session |
| 22 | `tests/integration/session.test.js` | Session anonyme, active et expirée |

### À modifier

| Fichier | Modification ciblée |
| --- | --- |
| `package.json` | Scripts `dev`, `start`, `test`, dépendances serveur et dev |
| `package-lock.json` | Verrou correspondant, sans mise à jour opportuniste hors périmètre |
| `.gitignore` | Ignorer `.env`, magasins de session et données runtime |
| `index.html` | Plus tard dans la même phase : point d'entrée de session sans formulaire de mot de passe |
| `sources/apps/session-select/index.html` | Remplacer le formulaire par l'action SSO |
| `sources/apps/session-select/app.js` | Supprimer l'appel direct et rediriger vers `/auth/login` |
| `sources/assets/javascripts/all.js` | Remplacer `localStorage.UserData` par `GET /api/session` |

### À conserver inchangés pendant cette tranche

- `sources/assets/javascripts/window/*` ;
- `sources/apps/parametres/*` ;
- tous les fonds d'écran et icônes ;
- les fragments Navigateur et Jellyfin.

Leur migration appartient aux phases suivantes et sera couverte par des tests dédiés.
