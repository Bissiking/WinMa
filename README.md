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
npm run test:visual # serveur local lancé sur le port 3210
npm audit
```

## Architecture actuelle

- `src/server/` : nouveau serveur Express, SSO Kyros, sécurité et API ;
- `sources/assets/javascripts/luma-*.js` : shell et gestionnaire de fenêtres modulaires ;
- `sources/apps/parametres/` : thèmes Clair, Sombre, Luma et Automatique, accent, fond, densité et mouvement ;
- `sources/apps/documents/` : explorateur Documents et interface de Corbeille ;
- `data/apps.json` : registre contrôlé des applications ;
- `data/settings/` : paramètres runtime ignorés par Git et isolés par sujet Kyros ;
- `data/luma.sqlite` : métadonnées Documents en développement, ignorées par Git ;
- `storage/documents/` : contenus importés, hors base de données et ignorés par Git ;
- `tests/` : tests unitaires et d'intégration avec faux fournisseur Kyros ;
- `docs/` : audit, architecture, roadmap et journal de migration.

## Déclarer une application

Ajouter une entrée validée dans `data/apps.json`. Un identifiant doit contenir uniquement des lettres minuscules, chiffres et tirets. Les types disponibles sont `internal`, `iframe`, `external` et `system`. Une application iframe doit déclarer son origine autorisée ; cette origine doit aussi être ajoutée à la CSP serveur après vérification.

## API disponible

- `GET /api/health` ;
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
- `GET /api/documents` et `GET /api/documents/folders` ;
- `POST /api/documents/folders` et `POST /api/documents/upload` ;
- `PATCH /api/documents/:id` et `GET /api/documents/:id/download` ;
- `POST /api/documents/actions/trash`, `/restore`, `/delete` et `/empty-trash`.

Les routes privées utilisent exclusivement l'utilisateur de la session. Un identifiant fourni par le navigateur n'est jamais utilisé pour choisir le fichier d'un utilisateur.

Le profil Kyros affiché dans Paramètres est en lecture seule. Les champs modifiables appartiennent au profil Luma local : nom préféré, langue, fuseau horaire et consentements de partage. `/api/users/me/context` ne retourne le profil et l’apparence que lorsque leur synchronisation respective est activée.

Documents applique un quota serveur de 1 Gio par sujet Kyros. La Corbeille compte dans ce quota jusqu’à la suppression définitive et les éléments âgés de 30 jours sont purgés automatiquement lors de l’accès au service. SQLite ne contient que les métadonnées ; la frontière repository permet de brancher PostgreSQL en production sans placer les fichiers dans la base.

## Documentation

- [`docs/AUDIT.md`](docs/AUDIT.md) ;
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) ;
- [`docs/ROADMAP.md`](docs/ROADMAP.md) ;
- [`docs/MIGRATION.md`](docs/MIGRATION.md).
