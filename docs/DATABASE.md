# Base de données hybride — SQLite (développement) et PostgreSQL (production)

> Contrat de persistance de Luma OS · Révision : 14 octobre 2026

Luma OS utilise **SQLite en développement** et **PostgreSQL en production**, derrière un
même contrat de repositories SQL natifs — **sans ORM** (ni Prisma, ni Sequelize). Les
sessions Express/Kyros, les fenêtres, les paramètres d'apparence, les préférences de
compte et les métadonnées Documents sont persistés en base. Les fichiers physiques
Documents restent sur disque ; seule leur métadonnée est en base.

## 1. Principe

| | Développement | Production |
| --- | --- | --- |
| Fournisseur | `DB_PROVIDER=sqlite` (défaut) | `DB_PROVIDER=postgresql` (**obligatoire**) |
| Données | `data/luma.sqlite` existant, **jamais effacé ni réinitialisé** | Base vierge initialisée par les migrations |
| Connexion | Fichier local (WAL) | `DATABASE_URL` ou `PGHOST`/`PGPORT`/`PGUSER`/`PGPASSWORD`/`PGDATABASE`, pool multi-connexions |
| Indisponibilité | — | **Le serveur s'arrête** : il n'existe aucun repli silencieux vers SQLite |
| Fichiers JSON historiques (`data/settings`, `data/accounts`) | Lus en repli puis reportés en base (lecture seule, aucun fichier supprimé) | Ignorés |

Garanties :

- **Aucune migration de données de SQLite vers PostgreSQL** : la base de production
  démarre vide, uniquement schématisée par les migrations.
- **Aucune suppression ni réinitialisation** des données SQLite de développement.
- Les secrets et tokens Kyros restent exclusivement dans la session serveur
  (`auth_sessions`) ; jamais exposés au navigateur.
- L'isolation des utilisateurs est portée par l'identifiant Kyros : clés brutes
  (`window_sessions`) ou empreinte SHA-256 (`document_items`, `user_settings`,
  `account_preferences`), héritée des implémentations d'origine.

## 2. Variables d'environnement

| Variable | Rôle | Défaut |
| --- | --- | --- |
| `DB_PROVIDER` | `sqlite` ou `postgresql` | `sqlite` |
| `SQLITE_PATH` | Chemin du fichier SQLite (relatif au projet ou absolu) | `data/luma.sqlite` |
| `DATABASE_URL` | URL de connexion PostgreSQL (`postgresql://user:pass@host:port/db`) | — |
| `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE` | Connexion PostgreSQL discrète (alternative à `DATABASE_URL`) | — |
| `DB_POOL_MAX` | Taille du pool de connexions PostgreSQL | `10` |
| `DB_CONNECT_TIMEOUT_MS` | Délai de connexion initial | `5000` |
| `DB_IDLE_TIMEOUT_MS` | Fermeture des connexions inactives | `30000` |
| `DB_MIGRATIONS_DIR` | Répertoire des migrations | `migrations` |

Validations au démarrage (`src/server/config/env.js`) :

- `DB_PROVIDER` inconnu ⇒ erreur ;
- `NODE_ENV=production` sans `DB_PROVIDER=postgresql` ⇒ erreur (SQLite interdit en production) ;
- `DB_PROVIDER=postgresql` sans `DATABASE_URL` ni `PGDATABASE` ⇒ erreur.

## 3. Migrations versionnées

Répertoire `migrations/`, convention de nommage :

```text
migrations/
├── 0001_auth_sessions.sqlite.sql        # Sessions Express/Kyros
├── 0001_auth_sessions.postgresql.sql
├── 0002_window_sessions.sqlite.sql      # Disposition des fenêtres
├── 0002_window_sessions.postgresql.sql
├── 0003_document_items.sqlite.sql       # Métadonnées Documents
├── 0003_document_items.postgresql.sql
├── 0004_user_preferences.sqlite.sql     # Paramètres + préférences de compte
├── 0004_user_preferences.postgresql.sql
├── 0005_user_workspaces.sqlite.sql      # Espaces de travail nommés
└── 0005_user_workspaces.postgresql.sql
```

- Chaque migration est appliquée **une seule fois**, dans une transaction, et
  enregistrée dans `schema_migrations (version, name, applied_at)`.
- Le schéma cible doit correspondre au fournisseur actif : une migration
  « postgresql » est refusée sur une base SQLite et inversement.
- Toutes les migrations s'appliquent automatiquement au démarrage du serveur
  (`createApp`). Une exécution explicite est aussi possible :

```bash
npm run migrate          # applique les migrations du fournisseur DB_PROVIDER
```

**Ajouter une migration** : créer `NNNN_nom.sqlite.sql` **et**
`NNNN_nom.postgresql.sql` (même numéros, SQL écrit pour chaque dialecte), sans
jamais modifier une migration déjà appliquée.

## 4. Architecture code

```text
src/server/db/
├── sqlite-adapter.js      # better-sqlite3 → contrat async, verrou + transactions
├── postgres-adapter.js    # pg.Pool → contrat async, client isolé par transaction
├── migrator.js            # lecteur/appliqueur de migrations versionnées
└── index.js               # createDatabase(config) — échec fatal, aucun repli

src/server/repositories/
├── index.js                       # sélection selon database.provider
├── repository-database.js         # helpers (base ou chemin SQLite)
├── sqlite-session-store-repository.js / pg-session-store-repository.js
├── sqlite-session-repository.js   / pg-session-repository.js
├── sqlite-document-repository.js  / pg-document-repository.js
├── sqlite-preferences-repository.js / pg-preferences-repository.js
└── sqlite-workspace-repository.js   / pg-workspace-repository.js
```

- **Contrat asynchrone uniforme** : toutes les méthodes de repository retournent
  des promesses ; les transactions passent par `database.transaction(fn)` avec un
  contexte isolé (`AsyncLocalStorage`), sérialisé sur SQLite (connexion unique) et
  par client dédié sur PostgreSQL (pool).
- `createRepositories(database)` retourne `{ sessionStore, windowSessions,
  documents, settings, account }` avec le bon dialecte.
- `src/server/stores/session-store.js` adapte le repository de sessions au contrat
  callback d'express-session (`get/set/destroy/touch/prune`).
- Les services `settings-service` et `account-service` écrivent via repository et
  lisent, à défaut de ligne, le fichier JSON historique (repli), qui est ensuite
  reporté en base : **les données de développement existantes restent visibles**,
  sans jamais être supprimées.
- `document-service` est intégralement asynchrone ; les blobs Documents restent
  dans `storage/documents/<sha256(subject)>/<uuid>` (jamais en base).

## 5. Déploiement production

1. Provisionner une base PostgreSQL dédiée (v13+ recommandé ; testé sur 16) et un
   utilisateur avec les droits `CREATE`/`USAGE` sur cette base.
2. Renseigner l'environnement :

```bash
NODE_ENV=production
APP_BASE_URL=https://luma.example.test
SESSION_SECRET=<aléatoire, 32+ caractères>
DB_PROVIDER=postgresql
DATABASE_URL=postgresql://luma:<secret>@db.internal:5432/luma
# ou PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE
DB_POOL_MAX=10
```

3. Optionnel mais recommandé avant le premier démarrage :

```bash
npm run migrate
```

4. Démarrer : `npm start`. Les migrations restantes s'appliquent au démarrage ;
   un échec de connexion PostgreSQL **arrête le serveur** (code de sortie 1, journal
   `server_start_failed`) — il n'y a jamais de bascule silencieuse vers SQLite.
5. Sauvegardes : `pg_dump` régulier. Les contenus Documents restent à sauvegarder
   séparément (`storage/documents/`), fichier pour fichier.

Exemple `docker-compose.yml` minimal :

```yaml
services:
  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: luma
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: luma
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

## 6. Tests

```bash
npm test                                 # SQLite : toutes les suites s'exécutent
TEST_DATABASE_URL=postgresql://user:pass@host:5432/db npm test   # + suites PostgreSQL
```

Sous PowerShell :

```powershell
$env:TEST_DATABASE_URL = 'postgresql://winma:winma_test@127.0.0.1:5433/winma_test'
npm test
```

- Les tests PostgreSQL (`tests/unit/repositories-postgres.test.js`,
  `tests/unit/migrator.test.js`, `tests/integration/postgres.test.js`) créent une
  **base jetable** `luma_test_<id>` via `CREATE DATABASE` (droits `CREATE`
  requis — typiquement un utilisateur superuser sur une instance de test) et la
  suppriment après exécution.
- **Sans `TEST_DATABASE_URL`, ces tests sont explicitement sautés** avec le message
  « PostgreSQL non disponible : définissez TEST_DATABASE_URL… » — jamais exécutés
  contre SQLite.
- Un instance Docker de test :

```bash
docker run -d --name winma-pg-test -e POSTGRES_USER=winma -e POSTGRES_PASSWORD=winma_test \
  -e POSTGRES_DB=winma_test -p 5433:5432 postgres:16-alpine
```

- `tests/helpers/repository-contract.js` exerce le **même contrat** (fenêtres,
  sessions, préférences, Documents) contre les deux moteurs : toute divergence de
  dialecte (casse, `LIKE`, CTE récursives, transactions, BIGINT) casse l'un des
  deux ensembles.

## 7. Points d'attention

- Ne jamais faire tourner la production avec `DB_PROVIDER=sqlite` : le
  démarrage est refusé par conception.
- PostgreSQL doit être opérationnel avant le démarrage : aucun mécanisme de
  repli n'existe, par choix de sécurité.
- Les repositories sont liés à leur fournisseur (`assertProvider`) : brancher un
  repository SQLite sur une base PostgreSQL (ou l'inverse) lève une erreur
  explicite.
- `express-rate-limit` (routes d'authentification) reste en mémoire : pour un
  déploiement multi-instances, prévoir un store partagé (hors périmètre actuel).
