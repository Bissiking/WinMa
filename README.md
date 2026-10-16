# Luma OS

Luma OS est un bureau web expérimental pour accéder aux applications et services de l'écosystème LUMA. Le dépôt s'appelait historiquement WinMa ; son shell principal utilise désormais l’interface LUMA Fluent modulaire.

## Prérequis

- Node.js 18 LTS, 20 LTS ou 22 et supérieur ;
- une application Luma OS configurée en mode `sso` ou `hybrid` dans Kyros pour tester la connexion réelle.

## Installation

```bash
npm install
cp .env.example .env
npm start
```

Ouvrir ensuite `http://localhost:3000`.

Sans identifiants Kyros, le serveur et l'écran de session restent utilisables, mais le bouton de connexion est désactivé avec une explication. Aucun secret réel ne doit être ajouté à `.env.example` ou versionné.

## Configuration Kyros

Créer une application distincte pour Luma OS dans Kyros puis renseigner `.env` :

- `LUMA_KYROS_CLIENT_ID` ;
- `LUMA_KYROS_CLIENT_SECRET` ;
- `LUMA_KYROS_JWT_SECRET` ;
- `LUMA_KYROS_RESOURCE_AUDIENCE` ;
- `LUMA_KYROS_CALLBACK_URL` enregistré à l'identique dans Kyros ;
- les scopes demandés et requis.

Sonora Studio utilise `LUMA_SONORA_STUDIO_BASE_URL`. Le serveur Express transmet à Sonora le token Kyros de la session utilisateur dans l’en-tête `Authorization`; ce token n’est jamais transmis au frontend.

Le navigateur est redirigé vers `/authorize`. Le code est échangé par Express sur `/token`. Les access et refresh tokens restent dans la session serveur et ne sont jamais transmis au frontend. La déconnexion appelle `/revoke` puis détruit la session Luma OS.

## Scripts

```bash
npm run dev
npm start
npm test
npm run test:e2e  # recette navigateur (Chrome/Edge système ; LUMA_E2E_BROWSER=firefox|webkit après `npx playwright-core install firefox webkit`)
npm run migrate    # applique les migrations SQL du fournisseur DB_PROVIDER
npm run test:visual # serveur local lancé sur le port 3210
npm audit
```

## Architecture actuelle

- `src/server/` : nouveau serveur Express, SSO Kyros, sécurité et API ;
- `src/server/db/` et `migrations/` : persistance SQL hybride (SQLite en développement, PostgreSQL en production) et migrations versionnées ;
- `sources/assets/javascripts/luma-*.js` : shell et gestionnaire de fenêtres modulaires ;
- `sources/apps/parametres/` : thèmes Clair, Sombre, Luma et Automatique, accent, fond, densité et mouvement ;
- `sources/apps/documents/` : explorateur Documents et interface de Corbeille ;
- `data/apps.json` : registre contrôlé des applications ;
- `data/settings/` : paramètres runtime ignorés par Git et isolés par sujet Kyros (repli lecture seule sur SQLite) ;
- `data/luma.sqlite` : base SQLite de développement (sessions, fenêtres, paramètres, métadonnées Documents), ignorée par Git et jamais réinitialisée ;
- `storage/documents/` : contenus importés, hors base de données et ignorés par Git ;
- `tests/` : tests unitaires et d'intégration avec faux fournisseur Kyros ;
- `docs/` : audit, architecture, roadmap et journal de migration.

## Déclarer une application

Ajouter une entrée validée dans `data/apps.json` : c'est le registre unique, servi par `GET /api/apps` et consommé par le bureau au démarrage (le tableau local du shell n'est qu'un repli). Un identifiant doit contenir uniquement des lettres minuscules, chiffres et tirets. Chaque entrée déclare `name`, `icon` (symbole du sprite), `entry` (page HTML ou module sous `/apps/`), `module` (module ES chargé par la fenêtre), `type`, `enabled`, `window{width,height,minWidth,minHeight}` et, en option, `taskbarName`, `position`, `logo`, `hidden`, `storeManaged`, `incompatible`. Les types disponibles sont `internal`, `iframe`, `external` et `system`. Une application iframe doit déclarer son origine autorisée (`allowedOrigin`, https strict host[:port]) ; cette origine est injectée automatiquement dans le `frame-src` de la CSP au démarrage du serveur, sans configuration manuelle. `enabled: false` retire l'application du bureau sans supprimer sa déclaration.

## API disponible

- `GET /api/health` ;
- `GET /api/system/metrics` (métriques du Gestionnaire des tâches avec périmètre explicite) ;
- `GET /auth/login` ;
- `GET /auth/callback` ;
- `POST /api/auth/logout` ;
- `GET /api/session` ;
- `GET /api/apps` et `GET /api/apps/:appId` ;
- `GET /api/sonora-studio/status`, `/me`, `/tracks`, `/albums` et `/playlists` ;
- `POST /api/sonora-studio/upload`, `/albums` et `/playlists` ainsi que les opérations de modification associées ;
- `PATCH /api/sonora-studio/tracks/bulk-visibility` pour publier ou dépublier une sélection ;
- `GET /api/users/me/settings` ;
- `PATCH /api/users/me/settings`.
- `GET` et `PATCH /api/users/me/account` ;
- `GET /api/users/me/context` pour les modules Luma autorisés ;
- `GET /api/documents` (liste, recherche `?search=`, Corbeille `?trash`) et `GET /api/documents/folders` ;
- `POST /api/documents/folders` et `POST /api/documents/upload` ;
- `PATCH /api/documents/:id` et `GET /api/documents/:id/download` ;
- `POST /api/documents/actions/trash`, `/restore`, `/delete` et `/empty-trash` ;
- `GET /api/users/me/backup`, `POST /api/users/me/backup` et `POST /api/users/me/backup/reset` (sauvegarde, restauration et réinitialisation ciblée — voir [`docs/BACKUP.md`](docs/BACKUP.md)) ;
- `GET`, `POST /api/users/me/workspaces` et `GET/PATCH/PUT/DELETE /api/users/me/workspaces/:id` avec `POST /:id/activate` (espaces de travail : dispositions nommées du bureau, bascule avec rechargement).

Les routes privées utilisent exclusivement l'utilisateur de la session. Un identifiant fourni par le navigateur n'est jamais utilisé pour choisir le fichier d'un utilisateur.

En conteneur (Docker, LXC), `/api/system/metrics` lit les limites CPU/RAM effectives via les cgroups (v2 puis v1, avec remontée des ancêtres) et n'expose jamais les valeurs de l'hôte comme celles du conteneur : une métrique non fiable est renvoyée « indisponible » (`null`). `LUMA_METRICS_PROBE_ROOT` peut pointer vers un collecteur en lecture seule — un dossier cgroup monté en lecture seule, ou la racine d'une machine avec `sys/fs/cgroup` et `proc/self/cgroup` — pour exposer le périmètre réel, par exemple celui d'un LXC parent hébergeant le conteneur Docker ; aucun accès privilégié à Docker ni à Proxmox n'est requis. `LUMA_METRICS_SCOPE=host|container` force le périmètre (débogage).

Le profil Kyros affiché dans Paramètres est en lecture seule. Les champs modifiables appartiennent au profil Luma local : nom préféré, langue, fuseau horaire et consentements de partage. `/api/users/me/context` ne retourne le profil et l’apparence que lorsque leur synchronisation respective est activée.

Documents applique un quota serveur de 1 Gio par sujet Kyros. La Corbeille compte dans ce quota jusqu’à la suppression définitive et les éléments âgés de 30 jours sont purgés automatiquement lors de l’accès au service. SQLite ou PostgreSQL ne contiennent que les métadonnées ; les contenus restent des fichiers dans `storage/documents/`. La couche repositories SQL est commune aux deux moteurs, sélectionnés par `DB_PROVIDER` — voir [`docs/DATABASE.md`](docs/DATABASE.md).

## Documentation

- [`docs/AUDIT.md`](docs/AUDIT.md) ;
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) ;
- [`docs/DATABASE.md`](docs/DATABASE.md) ;
- [`docs/BACKUP.md`](docs/BACKUP.md) ;
- [`docs/ROADMAP.md`](docs/ROADMAP.md) ;
- [`docs/MIGRATION.md`](docs/MIGRATION.md).
