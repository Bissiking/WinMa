# Index technique de Luma OS

Index de référence du dépôt (historiquement WinMa). Arborescence, routes API, couches serveur, shell frontend, applications et tests. Généré le 8 août 2026 à partir de la version `3.1.0`.

## 1. Vue d'ensemble

| Élément | Valeur |
| --- | --- |
| Nom | Luma OS (bureau web de l'écosystème LUMA) |
| Version | `3.1.0` |
| Stack | Node.js ≥ 18.18, Express 5, better-sqlite3 (dev) / pg (prod), HTML/CSS/JS natif (ES modules) |
| Point d'entrée npm | `src/server/server.js` |
| Identité | SSO par code d'autorisation Kyros (mode `sso` ou `hybrid`) |
| Frontend | Racine statique `sources/`, shell `index.html` + `luma-shell.js` |

Scripts : `npm run dev` (nodemon), `npm start`, `npm test` (node --test), `npm run migrate`, `npm run test:watch`, `npm run test:visual` (port 3210), `npm audit`.

## 2. Arborescence

Sans `node_modules/`, `.git/`, contenu `storage/documents/<hash>/` ni fichiers runtime de `data/`.

```text
WinMa/
├── index.html                        # Shell du bureau (racine servie)
├── API.md                            # Analyse du contrat d'authentification Nino/Kyros
├── DESIGN.md                         # Brief de refonte visuelle LUMA Fluent
├── PRODUCT.md                        # Produit et périmètre
├── README.md                         # Installation, configuration, API, documentation
├── package.json / package-lock.json
├── .env / .env.example               # Configuration (jamais de secrets versionnés)
├── .gitignore / .gitattributes
│
├── src/server/                      # NOUVEAU backend Express (actif)
│   ├── server.js                    # Chargement config + écoute du port
│   ├── app.js                       # Construction de l'application Express
│   ├── config/
│   │   ├── env.js                   # Validation des variables d'environnement
│   │   └── security.js              # Helmet + CSP durcie (frame-src dynamique)
│   ├── db/                            # Adapters SQLite/PostgreSQL + migrator
│   ├── controllers/                 # 10 contrôleurs HTTP
│   ├── middlewares/                 # 5 middlewares
│   ├── repositories/                 # Contrat SQL commun sqlite/pg (sessions, fenêtres, préférences, documents)
│   ├── routes/                      # 11 fichiers de routes
│   ├── services/                    # 10 services métier
│   ├── stores/                      # Session store express-session générique
│   └── utils/                       # api-response, async-handler, http-error, logger
│
├── migrations/                      # Migrations SQL versionnées (paires .sqlite.sql / .postgresql.sql)
│
├── sources/                         # Frontend (servi en statique)
│   ├── apps/                        # 17 applications frontend
│   ├── assets/
│   │   ├── css/                     # luma-shell
│   │   ├── fonts/                   # Open Sans (33 variantes) + Kristen Hand Bold
│   │   └── javascripts/             # luma-shell, luma-window-manager, luma-api + modules luma-*
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
│   ├── helpers/                     # test-config, test-server, fake-kyros, db, repository-contract
│   ├── e2e/                         # Recette navigateur (npm run test:e2e)
│   ├── integration/                 # auth, apps, harmonix, postgres, server, service-worker…
│   └── unit/                        # suites unitaires (services, repositories, migrator…)
├── scripts/                         # visual-check, test-e2e, migrate, sw-update-cycle
├── .github/workflows/ci.yml         # CI : audit, tests SQLite + PostgreSQL, recette 3 moteurs
├── docs/                            # AUDIT, ARCHITECTURE, DATABASE, MIGRATION, ROADMAP, INDEX
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

### Sauvegarde

| Méthode | Route | Session | Description |
| --- | --- | --- | --- |
| `GET` | `/api/users/me/backup` | Oui | Export agrégé : paramètres, compte, fenêtres, notes texte |
| `POST` | `/api/users/me/backup` | Oui | Import d'une sauvegarde (body JSON 8 Mo, recrée/mett à jour sans supprimer) |
| `POST` | `/api/users/me/backup/reset` | Oui | Réinitialisation ciblée (`settings`, `account`, `windows`, `notes`) |

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
| `backup-controller.js` | Export, import et réinitialisation des données personnelles |
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
| `backup-service.js` | Export/import/réinitialisation agrégés (paramètres, compte, fenêtres, notes texte), format `luma-backup` v1 |
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
| `config/security.js` | Helmet + CSP durcie (`script-src 'self'`, aucun CDN, `script-src-attr 'none'`, `frame-src` alimenté par les `allowedOrigin` du registre, `normalizeFrameOrigin`) |
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
| `assets/javascripts/luma-api.js` | Client API (`requestJson`, `patchJson`, `postJson`, `putJson`, cookies same-origin) |
| `assets/javascripts/luma-shell.js` | Boot du bureau : registre de repli + chargement de `GET /api/apps`, lancement, icônes, toasts |
| `assets/javascripts/luma-window-manager.js` | Gestionnaire de fenêtres (Map d'états, z-index, cascade, layout adaptatif de la barre des tâches, pointer/touch) |

> Nettoyage du 14 octobre 2026 : les scripts et styles hérités WinMa (`all.js`, `window/*`, `jquery/`, `date-time.js`, `start-locked.js`, `allstyles.css`, `window.css`, `start-menu.css`) ont été supprimés après vérification de non-utilisation.

## 9. Applications

### Registre serveur (`data/apps.json`) — source de vérité unique

| Id | Nom | Type | Activée | Entrée / module |
| --- | --- | --- | --- | --- |
| `documents` | Documents | `system` | oui | `/apps/documents/app.js` |
| `calculator` | Calculatrice | `internal` | oui | `/apps/calculator/app.js` |
| `terminal` | Terminal | `internal` | oui | `/apps/terminal/app.js` |
| `calendar` | Calendrier | `internal` | oui | `/apps/calendar/app.js` |
| `settings` | Paramètres | `internal` | oui | `/apps/parametres/app.js` |
| `task-manager` | Gestionnaire des tâches | `internal` | oui | `/apps/task-manager/app.js` |
| `luma-orbit` | Luma Orbit | `internal` | oui | `/apps/luma-orbit/app.js` |
| `sonora-studio` | Sonora Studio | `internal` | non (incompatible, store) | `/apps/sonora-studio/app.js` |
| `braindump` | BrainDump | `internal` | non (incompatible, store) | `/apps/braindump/app.js` |
| `matheo-systems` | Matheo Systems | `internal` | oui (cachée) | `/apps/matheo-systems/app.js` |
| `notepad` | Bloc-notes | `internal` | oui | `/apps/notepad/app.js` |
| `image-viewer` | Photos Luma | `internal` | oui (cachée) | `/apps/image-viewer/app.js` |
| `music-player` | Lecteur de musique | `internal` | oui (cachée) | `/apps/music-player/app.js` |
| `video-player` | Lecteur vidéo | `internal` | oui (cachée) | `/apps/video-player/app.js` |
| `power` | Alimentation | `internal` | oui (cachée) | `/apps/power/app.js` |
| `timer` | Minuteur | `internal` | oui | `/apps/timer/app.js` |
| `trash` | Corbeille | `system` | oui | `/apps/documents/app.js` |

### Applications frontend (`sources/apps/`)

| Dossier | Fichiers | Rôle |
| --- | --- | --- |
| `documents/` | app.js, style.css | Explorateur Documents et interface Corbeille |
| `parametres/` | app.js, style.css | Paramètres : thèmes, fond, accent, densité, mouvement, compte, démarrage, sauvegarde |
| ~~`session-select/`~~ | ~~style.css~~ | Écran de session fusionné dans le shell : styles migrés dans `luma-shell.css` (dossier supprimé) |
| `sonora-studio/` | app.js, style.css | Studio : morceaux, albums, playlists, upload, accès |
| `braindump/` | app.js, style.css | Notes et pensées (capture rapide + analyse) |
| `harmonix-player/` | app.js, player.html, style.css | Lecteur du catalogue Harmonix public |
| `image-viewer/` | app.js, style.css | Visionneuse d'images (Photos Luma) |
| `notepad/` | app.js, style.css | Bloc-notes (documents texte/markdown, rendu inline) |
| `task-manager/` | app.js, style.css | Gestionnaire des tâches (métriques système) |
| `calendar/` | app.js, style.css | Agenda local (événements, mois/semaine) |
| `calculator/` | app.js, style.css | Calculatrice |
| `music-player/` | app.js, style.css | Lecteur de musique (Harmonix) |
| `video-player/` | app.js, style.css | Lecteur vidéo |
| `luma-orbit/` | app.js, style.css | Vue d'ensemble de l'écosystème LUMA (services) |
| `matheo-systems/` | app.js, style.css | Vue système Matheo (CPU, mémoire, réseau) — cachée, lancée via `sudo reboot` dans le Terminal |
| `power/` | app.js, style.css | Alimentation : état réel de la batterie via la Battery API (niveau, charge, temps restant) |
| `timer/` | app.js, style.css | Minuteur (pomodoro, pause) + chronomètre avec tours, alerte sonore et notification Luma |
| ~~`desktop/`~~ | ~~index.html, style.css~~ | Fragment hérité supprimé (nettoyage du 14 octobre 2026) |
| ~~`web-frame/`~~ | ~~app.js, style.css~~ | Hôte iframe générique — supprimé (Navigateur LUMA et Jellyfin retirés) |

> À noter : `data/apps.json` est la source de vérité unique du bureau ; le shell (`luma-shell.js`) les reçoit via `GET /api/apps` au démarrage de la session et ne garde qu'un tableau de repli local pour le premier rendu et le hors ligne. `harmonix-player` reste un module monté globalement (lecteur Harmonix), hors registre d'applications ouvrables. Le Navigateur LUMA (`browser`) et Jellyfin ont été retirés : Luma OS refuse les connexions externes.

## 10. Tests

| Fichier | Type | Cible |
| --- | --- | --- |
| `tests/helpers/test-config.js` | Helper | Config minimale de test (Kyros désactivé par défaut) |
| `tests/helpers/test-server.js` | Helper | Démarre/arrête un serveur sur un port éphémère |
| `tests/helpers/fake-kyros.js` | Helper | Faux Kyros v4 (PAR, codes, JWKS, jetons) + `loginAs` |
| `tests/helpers/db.js` | Helper | Bases SQLite temporaires et bases PostgreSQL jetables |
| `tests/helpers/repository-contract.js` | Helper | Contrat commun repositories SQLite/PostgreSQL |
| `tests/e2e/helpers/e2e.js` | Helper E2E | Moteur de recette (Chromium système, ou Firefox/WebKit via `LUMA_E2E_BROWSER`) + serveur de test authentifié |
| `tests/e2e/shell.e2e.test.js` | E2E | Recette shell : écran de session, bureau, registre, fenêtres, Service Worker, viewport mobile (`npm run test:e2e`) |
| `tests/e2e/apps.e2e.test.js` | E2E | Parcours métier : Documents (dossier, import, corbeille, quota), Bloc-notes, Calendrier, Terminal (commandes, easter egg `sudo reboot`) |
| `tests/e2e/lock.e2e.test.js` | E2E | Verrouillage de session : verrou manuel, inactivité simulée, propagation multi-onglets, 401 serveur |
| `tests/e2e/backup.e2e.test.js` | E2E | Sauvegarde : export téléchargé, contrôle du fichier, import avec restauration |
| `tests/integration/auth.test.js` | Intégration | Flux SSO : login, callback, state, session, logout (JWT simulés) |
| `tests/integration/backup.test.js` | Intégration | `/api/users/me/backup` : 401, export agrégé, restauration, refus, réinitialisation |
| `tests/integration/apps.test.js` | Intégration | `/api/apps` : 401, métadonnées, 400/404 |
| `tests/integration/harmonix.test.js` | Intégration | Proxy Harmonix : catalogue, streaming, couvertures |
| `tests/integration/postgres.test.js` | Intégration | Persistance PostgreSQL (TEST_DATABASE_URL) |
| `tests/integration/server.test.js` | Intégration | Serveur complet : health, session, apps, 404, erreurs |
| `tests/unit/account.test.js` | Unitaire | Service compte : validations, lecture, écriture atomique |
| `tests/unit/app-registry.test.js` | Unitaire | Validation du registre d'applications |
| `tests/unit/braindump.test.js` | Unitaire | Service BrainDump (fake fetch) |
| `tests/unit/documents.test.js` | Unitaire | Repository SQLite Documents : CRUD, corbeille, quota |
| `tests/unit/env.test.js` | Unitaire | Configuration : défauts et exigences de production |
| `tests/unit/migrator.test.js` | Unitaire | Migrations SQL versionnées (SQLite + PostgreSQL) |
| `tests/unit/repositories-sqlite.test.js` | Unitaire | Contrat repositories sur SQLite |
| `tests/unit/repositories-postgres.test.js` | Unitaire | Contrat repositories sur PostgreSQL |
| `tests/unit/settings.test.js` | Unitaire | Service paramètres : liste blanche, validation |
| `tests/unit/sonora-studio.test.js` | Unitaire | Service Sonora (fake fetch) |
| `tests/unit/system-metrics.test.js` | Unitaire | Métriques CPU/mémoire/uptime |

## 11. Scripts, données et documentation

| Élément | Rôle |
| --- | --- |
| `scripts/visual-check.mjs` | Vérification visuelle Playwright : route `/api/**` mockée, captures dans `.impeccable/quality-bar/` |
| `scripts/test-e2e.mjs` | Lance la recette navigateur (`npm run test:e2e`) avec LUMA_E2E=1 |
| `scripts/migrate.js` | Applique les migrations SQL du fournisseur actif (`npm run migrate`) |
| `.impeccable/` | Assets de refonte : design.json, mocks, sketches, quality-bar, questions, surfaces |
| `docs/AUDIT.md` | Audit technique (risques, statique du code et dépendances) |
| `docs/ARCHITECTURE.md` | Architecture cible : SSO, API, registre, fenêtres, paramètres, sécurité |
| `docs/DATABASE.md` | Persistance hybride SQLite/PostgreSQL : config, migrations, déploiement, tests |
| `docs/BACKUP.md` | Sauvegarde/export/restauration : format `luma-backup`, pas-à-pas, API |
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
