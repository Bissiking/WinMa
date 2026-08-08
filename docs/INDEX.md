# Index technique de Luma OS

Index de référence du dépôt (historiquement WinMa). Arborescence, routes API, couches serveur, shell frontend, applications et tests. Généré le 8 août 2026 à partir de la version `3.1.0`.

## 1. Vue d'ensemble

| Élément | Valeur |
| --- | --- |
| Nom | Luma OS (bureau web de l'écosystème LUMA) |
| Version | `3.1.0` |
| Stack | Node.js ≥ 18.18, Express 5, better-sqlite3, HTML/CSS/JS natif (ES modules) |
| Point d'entrée npm | `src/server/server.js` |
| Identité | SSO par code d'autorisation Kyros (mode `sso` ou `hybrid`) |
| Frontend | Racine statique `sources/`, shell `index.html` + `luma-shell.js` |

Scripts : `npm run dev` (nodemon), `npm start`, `npm test` (node --test), `npm run test:watch`, `npm run test:visual` (port 3210), `npm audit`.

## 2. Arborescence

Sans `node_modules/`, `.git/`, contenu `storage/documents/<hash>/` ni fichiers runtime de `data/`.

```text
WinMa/
├── index.html                        # Shell du bureau (racine servie)
├── app.js                            # Ancien serveur Express (hérité, conservé)
├── API.md                            # Analyse du contrat d'authentification Nino/Kyros
├── DESIGN.md                         # Brief de refonte visuelle LUMA Fluent
├── PRODUCT.md                        # Produit et périmètre
├── README.md                         # Installation, configuration, API, documentation
├── package.json / package-lock.json
├── .env / .env.example               # Configuration (jamais de secrets versionnés)
├── structure-winma.txt               # Dump d'arborescence historique (obsolète)
├── structure-luma-os.txt             # Dump d'arborescence avec node_modules
├── luma-kyros-sso.txt                # Référence SSO Kyros
├── code-winma.txt                    # Export de code historique
├── .gitignore / .gitattributes
│
├── src/server/                      # NOUVEAU backend Express (actif)
│   ├── server.js                    # Chargement config + écoute du port
│   ├── app.js                       # Construction de l'application Express
│   ├── config/
│   │   ├── env.js                   # Validation des variables d'environnement
│   │   └── security.js              # Helmet + CSP
│   ├── controllers/                 # 9 contrôleurs HTTP
│   ├── middlewares/                 # 5 middlewares
│   ├── repositories/
│   │   └── sqlite-document-repository.js
│   ├── routes/                      # 10 fichiers de routes
│   ├── services/                    # 9 services métier
│   └── utils/                       # api-response, async-handler, http-error, logger
│
├── sources/                         # Frontend hérité (servi en statique)
│   ├── apps/                        # 15 applications frontend
│   ├── assets/
│   │   ├── css/                     # luma-shell, allstyles, window, start-menu
│   │   ├── fonts/                   # Open Sans (33 variantes) + Kristen Hand Bold
│   │   └── javascripts/             # luma-shell, luma-window-manager, luma-api + JS hérités
│   └── images/
│       ├── backgrounds/             # 12 fonds + 4K + luma-aurora
│       ├── favicon/ interface-logo/ loading/ locked/ menu-btn/
│
├── data/
│   ├── apps.json                    # Registre serveur des applications
│   ├── settings/<sha256>.json       # Paramètres runtime (ignorés par Git)
│   ├── accounts/<sha256>.json       # Préférences de compte runtime
│   └── luma.sqlite                  # Métadonnées Documents (dev, ignorée)
│
├── storage/documents/<owner-hash>/  # Contenus Documents (hors base, ignorés)
├── tests/
│   ├── helpers/                     # test-config.js, test-server.js
│   ├── integration/                 # auth, harmonix, server
│   └── unit/                        # 8 suites unitaires
├── scripts/visual-check.mjs         # Vérification visuelle Playwright
├── docs/                            # AUDIT, ARCHITECTURE, MIGRATION, ROADMAP, INDEX
├── TEST/                            # Prototype de test isolé (hérité)
├── users/                           # Données du prototype hérité (2, 3)
└── .impeccable/                     # Mocks, briefs, captures qualité de refonte
```

## 3. Routes API

### Authentification et session

| Méthode | Route | Session | Description |
| --- | --- | --- | --- |
| `GET` | `/auth/login` | Non | Démarre le SSO : génère `state`, redirige vers Kyros `/authorize` |
| `GET` | `/auth/callback` | Non | Valide `state`, échange le code sur `/token`, établit la session |
| `POST` | `/api/auth/logout` | Oui | Révoque le refresh token Kyros puis détruit la session |
| `GET` | `/api/session` | Non | État d'authentification + profil minimal ; refresh automatique si besoin |

### Applications et registre

| Méthode | Route | Session | Description |
| --- | --- | --- | --- |
| `GET` | `/api/apps` | Oui | Liste des applications autorisées depuis `data/apps.json` |
| `GET` | `/api/apps/:appId` | Oui | Détail d'une application (404 si inconnue) |

### Paramètres et compte

| Méthode | Route | Session | Description |
| --- | --- | --- | --- |
| `GET` | `/api/users/me/settings` | Oui | Lit les paramètres du bureau (thème, fond, densité…) |
| `PATCH` | `/api/users/me/settings` | Oui | Patch ciblé sur liste blanche de champs |
| `GET` | `/api/users/me/account` | Oui | Identité Kyros, préférences Luma, quota, synchronisation |
| `PATCH` | `/api/users/me/account` | Oui | Met à jour le profil Luma local (nom, langue, fuseau, consentements) |
| `GET` | `/api/users/me/context` | Oui | Contexte partagé entre modules (profil/apparence, versionné) |

### Documents et Corbeille

| Méthode | Route | Session | Description |
| --- | --- | --- | --- |
| `GET` | `/api/documents` | Oui | Liste, recherche ou Corbeille (`?parentId`, `?search`, `?trash`) |
| `GET` | `/api/documents/folders` | Oui | Arborescence des dossiers disponibles |
| `GET` | `/api/documents/:id/download` | Oui | Téléchargement du fichier du propriétaire de session |
| `GET` | `/api/documents/:id/preview` | Oui | Aperçu inline des images |
| `GET` | `/api/documents/:id/content` | Oui | Contenu texte (Bloc-notes) |
| `POST` | `/api/documents/folders` | Oui | Crée un dossier (nom unique par parent) |
| `POST` | `/api/documents/upload` | Oui | Importe un fichier (multer, max 256 Mo, quota 1 Gio) |
| `POST` | `/api/documents/text` | Oui | Crée un document texte/markdown |
| `PUT` | `/api/documents/:id/content` | Oui | Enregistre le contenu texte |
| `PATCH` | `/api/documents/:id` | Oui | Renomme/déplace, refuse les cycles |
| `POST` | `/api/documents/actions/trash` | Oui | Déplace une sélection vers la Corbeille (1-100) |
| `POST` | `/api/documents/actions/restore` | Oui | Restaure un groupe corbeille |
| `POST` | `/api/documents/actions/delete` | Oui | Supprime définitivement |
| `POST` | `/api/documents/actions/empty-trash` | Oui | Vide la Corbeille (purge 30 jours automatique) |

### Harmonix (catalogue public, sans session)

| Méthode | Route | Session | Description |
| --- | --- | --- | --- |
| `GET` | `/api/harmonix/tracks` | Non | Liste des pistes publiques normalisées |
| `GET` | `/api/harmonix/tracks/:trackId/stream` | Non | Flux audio avec support `Range` (proxifié) |
| `GET` | `/api/harmonix/covers/:coverName` | Non | Cover d'album (proxifiée, validée image) |

### Sonora Studio (proxy vers le backend Sonora, token Kyros serveur)

| Méthode | Route | Session | Description |
| --- | --- | --- | --- |
| `GET` | `/api/sonora-studio/status` | Oui | État d'authentification et version API |
| `GET` | `/api/sonora-studio/me` | Oui | Identité Sonora de l'utilisateur |
| `GET` | `/api/sonora-studio/tracks` | Oui | Liste/recherche de morceaux |
| `PATCH` | `/api/sonora-studio/tracks/bulk-visibility` | Oui | Publie/dépublie une sélection |
| `PATCH` | `/api/sonora-studio/tracks/:id` | Oui | Modifie une piste |
| `DELETE` | `/api/sonora-studio/tracks/:id` | Oui | Supprime une piste (`?deleteFile=true`) |
| `POST` | `/api/sonora-studio/upload` | Oui | Importe un fichier audio (max 100 Mo) |
| `GET/POST` | `/api/sonora-studio/albums` | Oui | Liste / création d'albums |
| `GET/PATCH/DELETE` | `/api/sonora-studio/albums/:id` | Oui | Détail / modification / suppression |
| `PUT` | `/api/sonora-studio/albums/:id/tracks` | Oui | Fixe les morceaux d'un album |
| `GET/POST` | `/api/sonora-studio/playlists` | Oui | Liste / création de playlists |
| `GET/PATCH/DELETE` | `/api/sonora-studio/playlists/:id` | Oui | Détail / modification / suppression |
| `PUT` | `/api/sonora-studio/playlists/:id/tracks` | Oui | Fixe les morceaux d'une playlist |
| `GET` | `/api/sonora-studio/access/roles` | Oui | Liste des rôles d'accès |
| `GET` | `/api/sonora-studio/access/users/:userId/roles` | Oui | Rôles d'un utilisateur |
| `PUT` | `/api/sonora-studio/access/users/:userId/roles` | Oui | Affecte les rôles d'un utilisateur |

### BrainDump (proxy vers Note Orbis)

| Méthode | Route | Session | Description |
| --- | --- | --- | --- |
| `GET` | `/api/braindump/notes` | Oui | Liste des notes |
| `POST` | `/api/braindump/analyze` | Oui | Analyse d'une pensée (2-5000 caractères) |
| `POST` | `/api/braindump/notes` | Oui | Crée une note |
| `DELETE` | `/api/braindump/notes/:id` | Oui | Supprime une note |

### Système

| Méthode | Route | Session | Description |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Non | État du serveur + version |
| `GET` | `/api/system/metrics` | Oui | CPU, mémoire, uptime, utilisateur actif |

## 4. Contrôleurs (`src/server/controllers/`)

| Fichier | Responsabilité |
| --- | --- |
| `auth-controller.js` | Login (state, redirection), callback (échange code, rotation session), logout (révocation + destruction) |
| `session-controller.js` | `GET /api/session`, refresh du jeton si nécessaire |
| `apps-controller.js` | Liste/détail des applications du registre |
| `settings-controller.js` | Lecture et patch des paramètres du bureau |
| `account-controller.js` | Compte (identité, préférences, quota, sync) et contexte inter-modules |
| `documents-controller.js` | CRUD Documents, upload, Corbeille, téléchargement, aperçu |
| `harmonix-controller.js` | Proxy catalogue/flux/covers Harmonix (pass-through d'en-têtes) |
| `sonora-studio-controller.js` | Proxy Sonora : morceaux, albums, playlists, accès, upload |
| `braindump-controller.js` | Proxy BrainDump : notes et analyse |

## 5. Services (`src/server/services/`)

| Fichier | Responsabilité |
| --- | --- |
| `kyros-service.js` | URL d'autorisation, échange du code, refresh, revoke, validation JWT (issuer, audience, resource_aud, client_id, scopes) |
| `session-service.js` | Établissement d'une session opaque, régénération (anti-fixation), refresh préemptif, destruction |
| `app-registry-service.js` | Chargement et validation de `data/apps.json` (types `internal`, `iframe`, `external`, `system`), source de vérité serveur |
| `settings-service.js` | Lecture/écriture atomique des paramètres par sujet hashé, liste blanche de champs |
| `account-service.js` | Préférences de compte Luma (nom, langue, fuseau, sync profile/apparence) en écriture atomique |
| `document-service.js` | Quota 1 Gio, arborescence, upload, texte, Corbeille 30 jours, purge |
| `harmonix-service.js` | Normalisation des pistes, streaming `Range`, couvertures — proxifie vers Harmonix |
| `sonora-studio-service.js` | Proxy API Sonora avec Bearer token Kyros serveur (morceaux, albums, playlists, rôles, upload) |
| `braindump-service.js` | Proxy API BrainDump avec Bearer token Kyros (notes, analyse) |

## 6. Middlewares (`src/server/middlewares/`)

| Fichier | Responsabilité |
| --- | --- |
| `request-context.js` | Identifiant de requête UUID (`X-Request-Id`) |
| `require-same-origin.js` | Refuse les écritures depuis une origine étrangère |
| `require-session.js` | Exige une session valide, refresh si besoin, pose `req.user` |
| `not-found.js` | Réponse 404 JSON uniforme |
| `error-handler.js` | Gestion d'erreurs unique, journalise sans exposer les détails en production |

## 7. Utilitaires et infrastructure

| Fichier | Rôle |
| --- | --- |
| `config/env.js` | Validation de la config (`NODE_ENV`, URLs, secrets Kyros, timeouts), refuse le démarrage en prod incomplète |
| `config/security.js` | Helmet + CSP (self, CDN jsdelivr, iframes internes uniquement) |
| `utils/api-response.js` | Enveloppe `{ success, data, message }` |
| `utils/async-handler.js` | Capture les rejets des contrôleurs async |
| `utils/http-error.js` | `HttpError(status, code, message)` ; messages exposés si `status < 500` |
| `utils/logger.js` | Journal JSON structuré avec masquage (`authorization`, `token`, `secret`…) |
| `repositories/sqlite-document-repository.js` | Persistance SQLite des métadonnées Documents (WAL, arborescence récursive, corbeille) |

## 8. Frontend — shell et gestionnaire de fenêtres

| Fichier | Rôle |
| --- | --- |
| `index.html` | Page unique du bureau (zones bureau, fenêtres, barre des tâches, menu, toasts) |
| `assets/css/luma-shell.css` | Styles du shell LUMA Fluent (thèmes, tokens, responsive) |
| `assets/css/allstyles.css`, `window.css`, `start-menu.css` | Styles hérités WinMa |
| `assets/javascripts/luma-api.js` | Client API (`requestJson`, `patchJson`, `postJson`, `putJson`, cookies same-origin) |
| `assets/javascripts/luma-shell.js` | Boot du bureau : registre frontend des applications, lancement, icônes, toasts |
| `assets/javascripts/luma-window-manager.js` | Gestionnaire de fenêtres (Map d'états, z-index, cascade, layout adaptatif de la barre des tâches, pointer/touch) |
| `assets/javascripts/all.js` | Regroupement hérité (bureau, horloge, verrouillage) |
| `assets/javascripts/notifications-horloge-date-start-menu/date-time.js` | Horloge/date héritées |
| `assets/javascripts/start-locked/start-locked.js` | Écran verrouillé hérité |
| `assets/javascripts/window/` | `move.js`, `open-close.js`, `uuid.js`, `agrandirImage.js`, `agrandirImageManuel.js` (fenêtres héritées) |

## 9. Applications

### Registre serveur (`data/apps.json`)

| Id | Nom | Type | Origine |
| --- | --- | --- | --- |
| `documents` | Documents | `system` | `/apps/documents/index.html` |
| `trash` | Corbeille | `system` | `/apps/documents/index.html` |
| `settings` | Paramètres | `internal` | `/apps/parametres/index.html` |
| `sonora-studio` | Sonora Studio | `internal` | `/apps/sonora-studio/app.js` |
| `braindump` | BrainDump | `internal` | `/apps/braindump/app.js` |

### Applications frontend (`sources/apps/`)

| Dossier | Fichiers | Rôle |
| --- | --- | --- |
| `desktop/` | index.html, style.css | Icônes du bureau (Documents, Corbeille) |
| `documents/` | app.js, index.html, style.css | Explorateur Documents et interface Corbeille |
| `parametres/` | app.js, index.html, style.css | Paramètres : thèmes, fond, accent, densité, mouvement, compte |
| `session-select/` | app.js, index.html, style.css | Écran d'accueil/verrouillage « Se connecter avec Kyros » |
| `sonora-studio/` | app.js, style.css | Studio : morceaux, albums, playlists, upload, accès |
| `braindump/` | app.js, style.css | Notes et pensées (capture rapide + analyse) |
| `harmonix-player/` | app.js, player.html, style.css | Lecteur du catalogue Harmonix public |
| `image-viewer/` | app.js, style.css | Visionneuse d'images (Photos Luma) |
| `notepad/` | app.js, style.css | Bloc-notes (documents texte/markdown, rendu inline) |
| `task-manager/` | app.js, style.css | Gestionnaire des tâches (métriques système) |
| `luma-orbit/` | app.js, style.css | Vue d'ensemble de l'écosystème LUMA (services) |
| `matheo-systems/` | app.js, style.css | Vue système Matheo (CPU, mémoire, réseau) — cachée, lancée via `sudo reboot` dans le Terminal |
| `power/` | app.js, style.css | Alimentation : état réel de la batterie via la Battery API (niveau, charge, temps restant) |
| `timer/` | app.js, style.css | Minuteur (pomodoro, pause) + chronomètre avec tours, alerte sonore et notification Luma |
| `web-frame/` | ~~app.js, style.css~~ | Hôte iframe générique — supprimé (Navigateur LUMA et Jellyfin retirés) |

> À noter : le registre serveur (`data/apps.json`) et le registre frontend (`luma-shell.js`) listent deux ensembles complémentaires : le frontend lance aussi `task-manager`, `luma-orbit`, `matheo-systems`, `notepad`, `image-viewer`, `harmonix-player`, absents du registre serveur. Le Navigateur LUMA (`browser`) et Jellyfin ont été retirés : Luma OS refuse les connexions externes.

## 10. Tests

| Fichier | Type | Cible |
| --- | --- | --- |
| `tests/helpers/test-config.js` | Helper | Config minimale de test (Kyros désactivé par défaut) |
| `tests/helpers/test-server.js` | Helper | Démarre/arrête un serveur sur un port éphémère |
| `tests/integration/auth.test.js` | Intégration | Flux SSO : login, callback, state, session, logout (JWT simulés) |
| `tests/integration/harmonix.test.js` | Intégration | Proxy Harmonix : catalogue, streaming, couvertures |
| `tests/integration/server.test.js` | Intégration | Serveur complet : health, session, apps, 404, erreurs |
| `tests/unit/account.test.js` | Unitaire | Service compte : validations, lecture, écriture atomique |
| `tests/unit/app-registry.test.js` | Unitaire | Validation du registre d'applications |
| `tests/unit/braindump.test.js` | Unitaire | Service BrainDump (fake fetch) |
| `tests/unit/documents.test.js` | Unitaire | Repository SQLite Documents : CRUD, corbeille, quota |
| `tests/unit/env.test.js` | Unitaire | Configuration : défauts et exigences de production |
| `tests/unit/settings.test.js` | Unitaire | Service paramètres : liste blanche, validation |
| `tests/unit/sonora-studio.test.js` | Unitaire | Service Sonora (fake fetch) |
| `tests/unit/system-metrics.test.js` | Unitaire | Métriques CPU/mémoire/uptime |

## 11. Scripts, données et documentation

| Élément | Rôle |
| --- | --- |
| `scripts/visual-check.mjs` | Vérification visuelle Playwright : route `/api/**` mockée, captures dans `.impeccable/quality-bar/` |
| `TEST/` | Prototype de test isolé (app.js, style.css, test.html) — hérité |
| `users/` | Données du prototype WinMa (`informations.json`, `parametres.json`) — hérité |
| `.impeccable/` | Assets de refonte : design.json, mocks, sketches, quality-bar, questions, surfaces |
| `docs/AUDIT.md` | Audit technique (risques, statique du code et dépendances) |
| `docs/ARCHITECTURE.md` | Architecture cible : SSO, API, registre, fenêtres, paramètres, sécurité |
| `docs/ROADMAP.md` | Phases de migration par incréments |
| `docs/MIGRATION.md` | État de la migration WinMa → Luma OS (fichiers remplacés/déplacés) |
| `docs/CHANGELOG.md` | Journal des versions : survol rapide puis détails par version |
| `API.md`, `PRODUCT.md`, `DESIGN.md` | Contrat Kyros/Nino, produit, brief visuel |

## 12. Références rapides

- Contrat API et sécurité : `README.md` + `docs/ARCHITECTURE.md`.
- Flux SSO : `src/server/controllers/auth-controller.js`, `src/server/services/kyros-service.js`.
- Quota Documents : `QUOTA_BYTES` (1 Gio) et `TRASH_RETENTION_DAYS` (30 j) dans `src/server/services/document-service.js`.
- Validation serveur : `HttpError` dans `src/server/utils/http-error.js`.
- Les routes privées utilisent exclusivement `req.user`/`req.session.kyros` (jamais un identifiant fourni par le navigateur).
