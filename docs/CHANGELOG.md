# Journal des versions (Changelog)

Format inspiré de [Keep a Changelog](https://keepachangelog.com/fr/) : chaque version expose un **survol** (rapide et court, à survoler) puis une section **détails** complète. Les versions marquées `alpha` sont des jalons internes ; seules les versions stables reçoivent un numéro public sans suffixe.

## 3.3.0-alpha — Survol

> Stockage, Réseau Luma, Démarrage enrichi, mises à jour automatiques et base de données hybride.

- **Base de données hybride** : la persistance passe en SQL natif sans ORM — SQLite en développement (`data/luma.sqlite` préservé), PostgreSQL en production (`DB_PROVIDER`, jamais de repli silencieux), repositories communs, migrations versionnées et tests sur les deux moteurs.
- **Registre d'applications unique** : `data/apps.json` décrit les 17 applications du bureau et devient la source de vérité — le shell les reçoit de `GET /api/apps` (son tableau local n'est plus qu'un repli), les états disponible / installée / activée / autorisée sont distingués et les champs inconnus ne fuient plus dans l'API.
- **Recette navigateur (E2E)** : `npm run test:e2e` exécute une vraie session navigateur (Chromium système, Firefox et WebKit) sur un serveur de test complet — écran de session, bureau, registre, fenêtres, Service Worker, viewport mobile **et parcours métier** (Documents : dossier/import/corbeille/restauration/quota ; Bloc-notes : édition/enregistrement/aperçu ; Calendrier : événement persistant ; Terminal : commandes et easter egg `sudo reboot`). Exécutée en CI à chaque push.
- **Nettoyage du code hérité** : 24 fichiers supprimés après vérification de non-utilisation — ancien serveur `app.js` racine, `all.js` et `window/*`, jQuery, scripts d'horloge/verrouillage, CSS hérités (`allstyles`, `window`, `start-menu`), fragments `desktop/`, `session-select/{index.html,app.js}`, `parametres/index.html`, prototype `TEST/` et dumps historiques (`structure-*`, `code-winma.txt`, `luma-kyros-sso.txt`).
- **CSP durcie** : plus aucun script inline ni CDN externe autorisé (`script-src 'self'`, `script-src-attr 'none'`), et le `frame-src` se remplit automatiquement des `allowedOrigin` déclarées dans le registre (origines https strictes), sans exception manuelle.
- **Écran de session unifié** : connexion et verrouillage partagent le même rendu habillé par `luma-shell.css` — le dossier fragment `session-select/` disparaît (styles migrés vers le shell, lien et précache retirés).
- **Verrouillage automatique de session** : le bureau se verrouille après une période d'inactivité (`lockAfterIdleMs`, réglable de 30 s à 24 h ou « Jamais », défaut 5 min). Le verrou garde la session, les fenêtres et le cache d'avatars ; « Reprendre la session » vérifie le serveur avant de rouvrir le bureau. Verrouillage et déconnexion se propagent aux autres onglets, et un 401 API ramène à l'écran de session (fermeture multi-appareils).
- **Sauvegarde, export et restauration** : nouvelle vue Paramètres > Sauvegarde — export d'un fichier JSON unique (paramètres, compte, disposition du bureau, notes texte et données locales du navigateur), import contrôlé qui recrée/mett à jour sans rien supprimer, et réinitialisation ciblée (paramètres, compte, disposition, notes) à double confirmation. Format versionné documenté dans `docs/BACKUP.md`.
- **Espaces de travail** : nouvelle vue Paramètres > Espaces pour enregistrer plusieurs dispositions nommées du bureau (capture de toutes les fenêtres ouvertes) et basculer de l'une à l'autre — la disposition de la cible est restaurée au rechargement, adaptée à la résolution courante.
- **Recherche globale** : `Ctrl+K` ouvre le menu Démarrer enrichi d'une recherche unifiée — applications, fichiers Documents, événements du Calendrier et réglages, groupés et ouvrables au clavier (flèches + Entrée).
- **Supervision conteneurisée** : le Gestionnaire des tâches lit désormais les limites CPU/RAM effectives via cgroups (Docker, LXC, natif) — plus aucune valeur de l'hôte n'est présentée comme celle du conteneur, et les métriques non fiables affichent « indisponible ». Un collecteur externe en lecture seule (`LUMA_METRICS_PROBE_ROOT`) couvre le cas Docker dans LXC.
- **Intégration continue** : workflow GitHub Actions (`.github/workflows/ci.yml`) — audit npm, tests SQLite, tests PostgreSQL (service postgres:16) et recette navigateur sur les trois moteurs.

- **Stockage** : nouvelle vue Paramètres > Stockage (quota 1 Go, répartition par type de fichier, espace Corbeille).
- **Réseau Luma** : nouvelle vue Paramètres > Réseau Luma (santé des services avec latence, session en cours, réseau de l'appareil).
- **Démarrage enrichi** : applications au démarrage réordonnables, délai et mode de lancement, profils nommés, options (Corbeille, Récents, dernier dossier, présentation) — gestion migrée du Gestionnaire des tâches vers Paramètres.
- **Documents Récents** : vue « Récents » dans la barre latérale de Documents (50 derniers fichiers modifiés), utilisée par l'option de démarrage.
- **Mises à jour automatiques** : le Service Worker se versionne à chaque déploiement, se vérifie au démarrage, au retour sur l'onglet et toutes les 30 minutes, et propose « Mettre à jour » avant d'activer la nouvelle version. Un déploiement à chaud (`git pull`, redémarrage du serveur) est signalé en direct à chaque onglet ouvert, sans rechargement de la page.
- **Centre de mise à jour** : nouvelle vue Paramètres > Mise à jour (version de Luma OS, build installé vs build disponible, périmètre) et icône d'état dans la barre des tâches.
- **Gestionnaire des tâches** : l'onglet Démarrage est retiré (configuration déplacée dans Paramètres).

## 3.3.0-alpha — Détails

### Ajouts

- **Persistance hybride SQLite / PostgreSQL** (sans ORM, sans migration de données) :
  - `DB_PROVIDER=sqlite|postgresql` (`src/server/config/env.js`) : `sqlite` en développement (fichier `data/luma.sqlite` conservé tel quel), `postgresql` en production — **obligatoire si `NODE_ENV=production`**, avec `DATABASE_URL` ou les variables libpq (`PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`) et un pool configurable (`DB_POOL_MAX`, `DB_CONNECT_TIMEOUT_MS`, `DB_IDLE_TIMEOUT_MS`) ;
  - **aucun repli** : si PostgreSQL est injoignable, le serveur s'arrête avec un message explicite (`Connexion PostgreSQL impossible … Aucun repli SQLite n'est autorisé`) ;
  - adapters SQL natifs (`src/server/db/`) : `sqlite-adapter.js` (better-sqlite3, verrou asynchrone, transactions imbriquées via `AsyncLocalStorage`), `postgres-adapter.js` (pg.Pool, client dédié par transaction) et `migrator.js` (migrations versionnées, transactionnelles, enregistrées dans `schema_migrations`) ;
  - repositories par moteur (`src/server/repositories/`) : sessions express-session, sessions Kyros, fenêtres, Documents, paramètres et préférences de compte — contrat asynchrone commun, sélection par `database.provider`, SQL dialecte par dialecte (`@named`/`COLLATE NOCASE` côté SQLite, `$n`/`LOWER()`/alias quotés côté PostgreSQL) ;
  - migrations `migrations/NNNN_nom.sqlite.sql` / `.postgresql.sql` : `0001_auth_sessions`, `0002_window_sessions`, `0003_document_items`, `0004_user_preferences` — appliquées au démarrage et via `npm run migrate` (`scripts/migrate.js`) ;
  - `createApp()` devient asynchrone (connexion, migrations, purge des sessions expirées au démarrage) ; fermeture propre du pool/des connexions sur SIGINT/SIGTERM ;
  - compatibilité : `settings-service` et `account-service` lisent encore les fichiers JSON historiques (`data/settings`, `data/accounts`) en repli sur SQLite et les reportent en base — aucun fichier supprimé ; les données de développement existantes restent intactes ;
  - tests : helpers `tests/helpers/db.js` (bases SQLite temp + bases PostgreSQL jetables créées via `CREATE DATABASE`) et `tests/helpers/repository-contract.js` (contrat commun aux deux moteurs) ; nouvelles suites `repositories-sqlite`, `repositories-postgres`, `migrator` et `tests/integration/postgres.test.js` ; les suites PostgreSQL s'exécutent avec `TEST_DATABASE_URL` et sont explicitement sautées sinon — jamais exécutées contre SQLite ;
  - documentation : [`docs/DATABASE.md`](DATABASE.md) (configuration, migrations, déploiement, tests, Docker) ; `.env.example` enrichi du bloc `DB_PROVIDER`/`DATABASE_URL`/pool.
- **Registre d'applications unique** (`data/apps.json`, source de vérité du bureau) :
  - le registre passe de 5 à 17 entrées : toutes les applications ouvrables (menu démarrer, barre des tâches, fenêtres) y sont désormais déclarées avec `entry` (page ou module sous `/apps/`), `module` (module ES chargé par la fenêtre), `type`, `enabled`, `taskbarName`, `window`, `position` et les drapeaux `hidden`/`storeManaged`/`incompatible` ; le champ mort `pinned` est retiré ;
  - `icon` devient le nom du symbole réellement rendu par le sprite du shell (les chemins d'images fantômes disparaissent) ; `logo` optionnel conserve les images de marque existantes ;
  - `app-registry-service` : validation enrichie (chemins internes sans `..`, `module`/`logo` sous `/apps/`, `window` à quatre dimensions positives, `position` bornée 0–1, drapeaux booléens, `allowedOrigin` obligatoire pour `iframe`) et **liste blanche** : seuls les champs publiés survivent, tout champ inconnu est retiré avant l'API ;
  - le shell (`luma-shell.js`) charge `GET /api/apps` en parallèle des paramètres au démarrage de la session et remplace son tableau local ; ce dernier reste un repli de premier rendu et hors ligne ; vocabulaire des états documenté : **activée** (`enabled` serveur), **disponible** (activée + installée si store), **installée** (liste `luma.orbit.installed`), **autorisée** (`allowedOrigin` déclarée) ;
  - Paramètres : la liste « Applications servies par le Service Worker » est filtrée sur le `type` du registre (elle était vide, le champ `module` étant retiré au montage) et affiche le point d'entrée ;
  - `scripts/visual-check.mjs` : le mock `/api/apps` sert le vrai `data/apps.json` ;
  - tests : `tests/unit/app-registry.test.js` enrichi (liste blanche, validation des chemins/fenêtres/positions/drapeaux, états) et nouvelle suite `tests/integration/apps.test.js` (401 sans session, métadonnées complètes, 400/404) ;
  - `package.json` versionné `3.3.0-alpha.1`.
- **Recette navigateur de bout en bout** (`tests/e2e/`, `npm run test:e2e`) :
  - helper E2E (`tests/e2e/helpers/e2e.js`) : détection automatique d'Edge/Chrome système (`LUMA_E2E_BROWSER_PATH` pour forcer), serveur de test sur port éphémère avec `appBaseUrl` aligné (validations d'origine), faux Kyros + cookie de session injecté dans le contexte navigateur (le parcours SSO reste couvert par `tests/integration/auth.test.js`) ;
  - six scénarios : écran de session anonyme ; démarrage du bureau authentifié avec chargement du registre serveur et menu démarrer (applications cachées/désactivées exclues, aucune erreur JS) ; ouverture de Documents depuis le menu avec fermeture de fenêtre ; `LumaOS.openApp` pour Terminal + Paramètres (montage `.settings-app`, fermeture cascade) ; Service Worker actif (`/sw.js` avec `RAW_BUILD_VERSION` et `Cache-Control` de no-cache) ; bureau utilisable en viewport mobile 390×844 ;
  - `scripts/test-e2e.mjs` : lancement portable (cmd/PowerShell/sh) qui force `LUMA_E2E=1` ; la recette est **sautée** dans `npm test` (suite unitaire/intégration maintenue < 2 s) ;
  - documentation README/INDEX ; `package.json` versionné `3.3.0-alpha.2`.
- **Nettoyage du code hérité sans régression** (24 fichiers supprimés, vérifiés un par un) :
  - serveur : `app.js` racine (ancien serveur Express autonome, remplacé par `src/server/`) ;
  - JavaScript hérité : `sources/assets/javascripts/all.js` (bootstrap jQuery), `window/{move,open-close,uuid,agrandirImage,agrandirImageManuel}.js`, `jquery/jquery-3.6.4.js`, `notifications-horloge-date-start-menu/date-time.js`, `start-locked/start-locked.js` — aucun `index.html`, import ou précache SW ne les référençait ;
  - CSS hérités : `allstyles.css`, `window.css`, `start-menu.css` (seul `luma-shell.css` est lié) ;
  - fragments : `sources/apps/desktop/`, `sources/apps/session-select/{index.html,app.js}` (l'écran de session est rendu par `luma-shell.js` ; `session-select/style.css` reste, lié par `index.html`), `sources/apps/parametres/index.html` (sélecteur de fonds hérité) ;
  - prototype et dumps : `TEST/`, `structure-winma.txt`, `structure-luma-os.txt`, `code-winma.txt`, `luma-kyros-sso.txt` (export obsolète du code actuel), `.DS_Store` (ajouté au `.gitignore`) ;
  - registre : les `entry` de `documents`, `trash` et `settings` pointent désormais vers leur module (`/apps/<id>/app.js`), les fragments `index.html` supprimés n'étant jamais servis ;
  - docs : INDEX (arborescence, tables, registre), ROADMAP et MIGRATION marqués à jour ; parcours validés par les 151 tests (SQLite + PostgreSQL) et les 6 scénarios E2E ;
  - `package.json` versionné `3.3.0-alpha.3`.
- **CSP durcie et intégrations iframes automatisées** :
  - `script-src` ramené à `'self'` : suppression de `'unsafe-inline'` (aucun script inline ni handler `onclick` dans le frontend) et du CDN `cdn.jsdelivr.net` (plus référencé) ; `script-src-attr` passé à `'none'` explicite ;
  - `frame-src` dynamique : `createApp()` charge le registre au démarrage et injecte les `allowedOrigin` des applications `iframe` activées via `listAllowedFrameOrigins()` ; une app désactivée n'apparaît plus dans la CSP ;
  - validation stricte des origines : `normalizeFrameOrigin` (exporté depuis `config/security.js`) n'accepte que `https://host[:port]` sans chemin, query, hash ni credentials — `http:`, `javascript:`, `data:` et les origines avec chemin sont refusées à la fois par le registre et en défense en profondeur dans la CSP ;
  - exception documentée et unique : `style-src 'unsafe-inline'`, nécessitée par 9 attributs `style=""` dynamiques (barres de progression, swatches, hauteurs) des apps internes — sans capacité d'exécution de code ;
  - trou d'injection `appRegistryPath` sur `createApp()` pour tester la CSP sans toucher au registre réel ;
  - tests : nouvelle suite `tests/integration/security-headers.test.js` (CSP sans script inline/CDN, `frame-src` limité à `'self'` sans iframe, origine injectée pour une app iframe activée, origine exclue pour une désactivée), nouveau `tests/unit/security.test.js` (`normalizeFrameOrigin` cas acceptés/refusés) et cas d'origine invalides ajoutés à `tests/unit/app-registry.test.js` ;
  - validation : 157 tests verts sur SQLite et PostgreSQL, recette navigateur 6/6 sous la CSP stricte ;
  - documentation README, ARCHITECTURE, INDEX et MIGRATION ; `package.json` versionné `3.3.0-alpha.4`.
- **Écran de session unifié (connexion + verrouillage)** :
  - le rendu unique `renderSessionScreen` (`luma-shell.js`) dessine déjà l'accueil Kyros et l'état « Session verrouillée. » ; les 148 lignes de styles qui l'habillaient quittaient le dossier fragment `sources/apps/session-select/` (héritier du formulaire supprimé) — elles migrent telles quelles dans `luma-shell.css` (section « Écran de session »), lien `<link>` retiré d'`index.html`, entrée `./apps/session-select/style.css` retirée du précache (`sources/sw.js` et `scripts/sw-update-cycle.mjs`), dossier supprimé ;
  - le chemin d'image relatif (`../../images/backgrounds/luma-aurora.webp`) reste identique entre les deux emplacements (deux niveaux sous `sources/`) ;
  - test E2E renforcé : l'écran de session doit être réellement habillé (fond `luma-aurora`, `min-height` = fenêtre, bouton de connexion coloré) — la recette détecterait toute perte des styles ;
  - validation : 157 tests verts sur SQLite et PostgreSQL, recette navigateur 6/6 ;
  - `package.json` versionné `3.3.0-alpha.5`.
- **Recette approfondie, multi-navigateurs et CI** :
  - nouvelle suite `tests/e2e/apps.e2e.test.js` : parcours métier profonds — Documents (nouveau dossier via dialogue, import via `setInputFiles`, quota avant/après, envoi Corbeille, restauration, retour racine), Bloc-notes (dirty, enregistrement, titre `•`, aperçu Markdown rendu), Calendrier (événement daté persisté dans `luma.calendar.events`, suppression) et Terminal (`help`/`echo`/`open`/``ps`/`close` puis easter egg `sudo reboot` → Matheo Systems) ; chaque parcours asserte l'absence d'erreur JS ;
  - helper multi-moteurs : `LUMA_E2E_BROWSER=firefox|webkit` bascule sur les moteurs Playwright (`npx playwright-core install firefox webkit`), Chromium reste le navigateur système par défaut — recette validée **10/10 sur les trois moteurs** ;
  - `scripts/test-e2e.mjs` exécute désormais les deux suites E2E (liste explicite, portable) ;
  - intérêts de test assouplis : fenêtres ciblées par `aria-label` puis ancrées par `id` (le titre change avec l'état, la sortie du Terminal contient les noms d'apps) ;
  - CI GitHub Actions (`.github/workflows/ci.yml`) : audit npm `--audit-level=high`, `npm test` SQLite, `npm test` PostgreSQL (service `postgres:16-alpine` + `TEST_DATABASE_URL`) et matrice de recette Chromium/Firefox/WebKit ;
  - `package.json` versionné `3.3.0-alpha.6`.
- **Verrouillage automatique et contrôle des sessions** :
  - nouveau paramètre serveur `lockAfterIdleMs` (défaut 300000 ms = 5 min ; 0 = jamais ; valideur `LOCK_AFTER_IDLE_INVALID` pour tout entier hors [30000, 86400000] hormis 0), exposé dans Paramètres > Démarrage (« Verrouillage automatique ») ;
  - shell : timer d'inactivité réarmé sur `pointerdown`/`keydown`/`touchstart`/`wheel` (throttle 1 s) ; à l'expiration `lockSession()` rend l'écran de session verrouillé sans toucher à la session, aux fenêtres ni aux avatars ;
  - « Reprendre la session » vérifie `GET /api/session` (`resumeSession`) avant de réafficher le bureau existant — plus de boot complet après un verrou ; session terminée côté serveur → écran de reconnexion ;
  - distinction verrouiller/déconnecter : le verrou ne détruit rien, la déconnexion (`POST /api/auth/logout`) détruit la session et se propage aux autres onglets (`BroadcastChannel` « luma.session », événements `lock`/`logout`, sans rebroadcast en boucle) ;
  - fermeture multi-appareils : `luma-api.js` attache `status`/`code` aux erreurs et dispatch `luma:session-expired` sur tout 401 → le shell rend l'écran de session (le boot s'interrompt sur 401 au lieu de réafficher un bureau fantôme) ;
  - `window.LumaOS.lock()` exposé pour le verrouillage programmatique ;
  - tests : validation unitaire `lockAfterIdleMs` (defaults, bornes, type) et nouvelle suite `tests/e2e/lock.e2e.test.js` (4 scénarios : verrou manuel + reprise avec fenêtre conservée, verrouillage automatique via horloge simulée `page.clock` avec propagation du verrou et de la déconnexion entre onglets, session serveur terminée après logout) ;
  - validation : 166 tests verts (SQLite 138 + PostgreSQL 152), recette navigateur **14/14 sur Chromium, Firefox et WebKit** ;
  - documentation ARCHITECTURE (règles de session) ; `package.json` versionné `3.3.0-alpha.7`.
- **Sauvegarde, export et restauration des données personnelles** :
  - service `src/server/services/backup-service.js` : `exportBackup` agrège paramètres (liste blanche), préférences de compte (sans le snapshot interne Kyros `lastProfileSync`), disposition du bureau (`window_sessions`) et **notes texte uniquement** — les fichiers binaires restent côté serveur et ne sont jamais embarqués — sous la forme de chemins relatifs ; `importBackup` restaure sans rien supprimer (notes existantes au même chemin remplacées, les autres recréées avec leurs dossiers) ; `resetBackup` vide les catégories choisies (`settings`, `account`, `windows`, `notes`) ;
  - format versionné `{ format: "luma-backup", schemaVersion: 1, exportedAt, version, server: {...}, browser: {...} }` avec contrôles : format inconnu (`BACKUP_INVALID`), version inconnue (`BACKUP_VERSION_UNSUPPORTED`), chemins de notes validés (`BACKUP_NOTE_PATH_INVALID`, profondeur ≤ 8, segments sans `..` ni caractère interdit), conflits de chemin (`BACKUP_PATH_CONFLICT`, un dossier ou une note ne peut pas recouvrir un fichier binaire existant) et limites (500 notes, 1 Mo/note, 5 Mo au total) ;
  - endpoints (`/api/users/me/backup`) : `GET` export, `POST` import (body parser dédié 8 Mo, le limiteur global de 1 Mo ne s'applique pas) et `POST /reset` — session obligatoire, même-origine, sujet toujours `req.user.id` ;
  - vue Paramètres > Sauvegarde : export téléchargé (`luma-sauvegarde-YYYY-MM-DD.json` avec la section `browser` — événements du Calendrier, apps Orbit, épingles, volume…), import via `setInputFiles` avec toast de restauration puis rechargement du bureau, et réinitialisation ciblée à double confirmation (« Confirmer la réinitialisation » pendant 6 s) ;
  - tests : `tests/integration/backup.test.js` (401 sans session, agrégation complète, restauration — notes créées/mises à jour, défauts réappliqués, refus format/version/chemin et CSRF 403, réinitialisation ciblée) et scénario E2E `tests/e2e/backup.e2e.test.js` (export → contrôle du fichier téléchargé → import du même fichier → toast + rechargement) ;
  - validation : 172 tests verts (SQLite 143 + PostgreSQL 157), recette navigateur **15/15 sur Chromium, Firefox et WebKit** ;
  - documentation [`docs/BACKUP.md`](BACKUP.md) et INDEX ; `package.json` versionné `3.3.0-alpha.8`.
- **Espaces de travail persistants et nommés** :
  - table `workspaces` (migrations `0005_user_workspaces`) : `id` uuid, `owner_key`, `name` (trim 1–40 caractères, unicité insensible à la casse par utilisateur), `windows_json` (disposition des fenêtres), `is_active` et horodatages — **20 espaces maximum** par utilisateur ;
  - service `src/server/services/workspace-service.js` : création depuis la disposition courante (l'espace créé devient actif), bascule (la disposition courante est d'abord enregistrée dans l'espace actif, puis la cible est chargée), enregistrement de la disposition, renommage et suppression ; la disposition courante reste gérée par `window_sessions` (synchro inchangée) ;
  - shell (`luma-shell.js`) : nouveaux `window.LumaOS.suspendSessionSync()` / `resumeSessionSync()` — la suspension est indispensable : sans elle le debounce de la synchro (600 ms) ré-écrirait l'ancienne disposition par-dessus la bascule ; la suspension fait aussi un flush attendu de la disposition courante, précisément nécessaire pour que le serveur capture la disposition réelle lors de la création ou de l'enregistrement d'un espace ;
  - endpoints `/api/users/me/workspaces` (`GET` liste, `POST` création) et `/api/users/me/workspaces/:id` (`PATCH` renommer, `PUT` enregistrer la disposition, `POST activate`, `DELETE`) — session obligatoire, même-origine sur les mutations, codes d'erreur dédiés (`WORKSPACE_INVALID_NAME`, `WORKSPACE_ID_INVALID`, `WORKSPACE_NAME_TAKEN`, `WORKSPACE_NOT_FOUND`, `WORKSPACE_LIMIT_REACHED`, `WORKSPACE_ACTIVE_REMOVE`, `WORKSPACE_LAST_REMOVE`) ;
  - vue Paramètres > Espaces (icône grille) : liste des espaces (actif en surbrillance, fenêtres, date de mise à jour), création par prompt de nom, actions Appliquer (rechargement du bureau), Enregistrer la disposition, Renommer et Supprimer à double confirmation (6 s) — la suppression est refusée sur l'espace actif et sur le dernier espace ; la restauration adapte déjà la disposition à la résolution courante (`restoreBounds`/`constrainBounds`) ;
  - tests : `tests/unit/workspaces.test.js` (9 scénarios : validation du nom, unicité, limite, capture de la disposition, bascule, suppression protégée) et `tests/integration/workspaces.test.js` (401 sans session, cycle de vie complet, validations, CSRF 403) + scénario E2E `tests/e2e/workspaces.e2e.test.js` (création de deux espaces, bascule avec rechargement du bureau, fenêtres restaurées puis bascule retour) ;
  - validation : 185 tests verts (SQLite 155 + PostgreSQL 169), recette navigateur **16/16 sur Chromium, Firefox et WebKit** ;
  - `package.json` versionné `3.3.0-alpha.9`.
- **Recherche globale unifiée** (panneau Démarrer, `Ctrl+K`) :
  - nouveau module `sources/assets/javascripts/luma-search.js` : logique pure de filtrage — normalisation sans accents ni casse, éligibilité du registre (applications cachées, incompatibles ou du store non installées jamais exposées), recherche d'événements sur les titres et catalogue de réglages (libellés + mots-clés → vues Paramètres) ;
  - le champ du menu Démarrer devient une recherche universelle (« Rechercher partout ») : sans requête, la grille d'applications reste inchangée ; avec une requête, les résultats sont groupés (Applications, Documents, Événements, Réglages) sous des titres de section, avec type et métadonnées (date de l'événement, nature du fichier) ;
  - Documents via `GET /api/documents?search=` (strictement le sujet de la session, arborescence complète, hors corbeille) — debounce 250 ms avec jeton de séquence contre les réponses obsolètes, minimum 2 caractères, 6 résultats maximum ;
  - ouverture des résultats : applications via `openApp` existant ; Documents ouvre l'application avec la recherche pré-remplie (`options.data.search` au montage + événement `luma:documents-search` quand la fenêtre est déjà ouverte, nettoyé au démontage) ; réglages ouvrent la vue cible (`options.data.view` + événement `luma:settings-view` déjà en place) ; événements ouvrent le Calendrier ;
  - navigation clavier : `Ctrl+K` ouvre le panneau (raccourci existant), ↑/↓ déplacent la sélection, Entrée ouvre le résultat sélectionné (ou le premier), Échap ferme ; la recherche est réinitialisée à la fermeture pour rouvrir sur la grille d'applications ;
  - tests : `tests/unit/search.test.js` (normalisation, éligibilité du registre, titres d'événements, catalogue de réglages), `tests/integration/search.test.js` (401, isolation stricte par sujet via un second jeton Kyros, exclusion de la Corbeille) et scénario E2E `tests/e2e/search.e2e.test.js` (fixtures document + événement, les quatre groupes, ouverture de chaque type de résultat, état vide, reset du champ) ;
  - validation : 193 tests verts (SQLite 162 + PostgreSQL 176), recette navigateur **17/17 sur Chromium, Firefox et WebKit** ;
  - `package.json` versionné `3.3.0-alpha.10`.
- **Supervision du Gestionnaire des tâches conteneurisée** (`GET /api/system/metrics`) :
  - **correction du bug** : en déploiement Docker (lui-même dans un LXC Proxmox), le Gestionnaire des tâches affichait les ressources de l'hôte (16 CPU, 141 Gio) au lieu de celles du conteneur (2 vCPU, 2 Gio) — `os.cpus()`, `os.totalmem()` et `os.loadavg()` décrivent le noyau hôte, jamais le périmètre d'exécution ;
  - nouveau service `src/server/services/system-metrics-service.js` : périmètre explicite (`meta.scope` : `host` | `container` | `probe`) et règle stricte — sur machine native, valeurs `node:os` inchangées ; en conteneur ou via collecteur, **uniquement** les cgroups du périmètre, avec remontée des ancêtres jusqu'à la limite la plus contraignante (cas Docker dans LXC avec cgroup ns host : la limite du LXC parent est retrouvée) ; cgroups v2 (`cpu.max`, `memory.max`, `memory.current`, `cpu.stat`) puis repli v1 (`cpu.cfs_quota_us`, `memory.limit_in_bytes`, `cpuacct.usage`) ; le pourcentage CPU est calculé sur la consommation cgroup normalisée par le quota effectif ;
  - **jamais de valeurs hôte déguisées** : sans limite lisible en conteneur, `logicalCores`, `totalBytes`, `percent` et `loadAverage` sont `null` (« indisponible ») plutôt que repris de l'hôte — la consommation cgroup isolément lisible reste exposée ;
  - collecteur lecture seule (`LUMA_METRICS_PROBE_ROOT`) : pointe vers un dossier cgroup monté en lecture seule ou la racine d'une machine (avec `sys/fs/cgroup` + `proc/self/cgroup`) — conçu pour exposer le cgroup du LXC parent à un conteneur Docker sans aucun accès privilégié à Docker ni à Proxmox ; `LUMA_METRICS_SCOPE=host|container` force le périmètre (débogage) et `LUMA_IN_CONTAINER=1` force la détection de conteneur ;
  - `GET /api/system/metrics` enrichi d'un bloc `meta` (`scope`, `containerized`, `probe`, `sources` — source exacte de chaque métrique) sans rupture de contrat : `cpu`, `memory`, `runtime` et `user` gardent leurs champs, les valeurs devenues non fiables étant `null` ;
  - interface inchangée : les valeurs `null` rendent « — » ou « … indisponibles », et la vue Performances affiche le périmètre collecté (« machine hôte » | « conteneur » | « collecteur (lecture seule) ») ;
  - tests : `tests/unit/system-metrics-service.test.js` (8 scénarios avec fs/os injectés : limites cgroups du conteneur contre valeurs hôte, remontée des ancêtres LXC, conteneur sans limites → indisponible, machine native, collecteur racine machine et dossier cgroup, repli v1, override `LUMA_METRICS_SCOPE`), `tests/integration/system-metrics.test.js` (401 sans session, contrat `meta`/sources/valeurs bornées) et scénario E2E `tests/e2e/task-manager.e2e.test.js` (contrat HTTP + vue Performances sans NaN) ;
  - validation : 204 tests verts (SQLite 172 + PostgreSQL 186), recette navigateur **18/18 sur Chromium, Firefox et WebKit** ;
  - `package.json` versionné `3.3.0-alpha.11`.

- **Paramètres > Stockage** : `GET /api/documents/stats` agrège l'usage par catégorie (images, vidéos, musique, documents, autres) et l'espace Corbeille ; la vue affiche le quota personnel, la répartition et la Corbeille.
- **Paramètres > Réseau Luma** : `GET /api/system/network` mesure la latence des services configurés (Kyros, Sonora, BrainDump, Harmonix), expose l'état de la session (hôte, transport, âge, expiration des jetons) et le réseau de l'appareil (`navigator.connection` avec repli).
- **Démarrage enrichi** (Paramètres > Démarrage) :
  - liste des applications éligibles avec activation et réordonnancement (↑/↓) ;
  - délai entre chaque lancement (0–5000 ms) et mode (Progressif / Simultané) ;
  - profils de démarrage (enregistrer le scénario actuel, appliquer, renommer, supprimer) ;
  - options : ouvrir la Corbeille, ouvrir les Récents, restaurer le dernier dossier de Documents, mode présentation (fenêtres maximisées).
- **Documents — vue Récents** : les 50 derniers fichiers modifiés, accessible depuis la barre latérale ; utilisée par l'option de démarrage « Ouvrir les Récents ».
- **Restauration du dernier dossier** : si l'option est active, Documents rouvre le dossier dans lequel l'utilisateur se trouvait (localStorage `luma.documents.last-folder`).
- **Mise à jour automatique du Service Worker** (`sources/assets/javascripts/luma-sw-update.js`, chargé par `index.html` avant le shell) :
  - détection d'une nouvelle version au démarrage, au retour sur l'onglet (`visibilitychange`), à la reconnexion et toutes les 30 minutes via `registration.update()` ;
  - **déploiement à chaud** : `GET /api/system/build-events` diffuse l'empreinte de build en Server-Sent Events ; chaque onglet connecté compare l'empreinte reçue à celle de `sw.js` et relance `registration.update()` dès qu'un déploiement la change. Le flux se reconnecte tout seul après un redémarrage du serveur, et `/api/health` expose la même empreinte sous le nom `build` ;
  - notification « Mise à jour disponible » dans la région de toasts existante, avec les actions « Mettre à jour » et « Plus tard » ;
  - activation du nouveau worker par `skipWaiting()` uniquement après confirmation de l'utilisateur, puis rechargement unique après `controllerchange` (drapeau en mémoire + horodatage anti-boucle, sauvegarde de la session avant le rechargement) ;
  - récupération en cas d'échec : notification « La mise à jour n'a pas pu être installée » avec « Réessayer », plus des re-essais automatiques à backoff exponentiel.
- **Version de build injectée dans `sw.js`** : `GET /sw.js` est servi par le serveur avec `Cache-Control: no-cache` et l'empreinte sha256 des ressources de `sources/`, de `index.html` et de `package.json` à la place du marqueur `__LUMA_BUILD__` (`src/server/services/build-version-service.js`) ; le cache devient `luma-shell-<empreinte>` et change à chaque déploiement.
- **Paramètres > Mise à jour** : nouveau centre de mise à jour Luma OS.
  - état courant (À jour, Mise à jour disponible, Installation en cours, Échec) avec badge dédié ;
  - version de Luma OS, build installé et build disponible côte à côte, service worker et dernière vérification ;
  - actions « Installer la mise à jour » et « Rechercher » — rien ne s'installe sans confirmation explicite ;
  - applications locales servies par le Service Worker et liste des ressources préchargées pour le hors ligne.
- **Icône de mise à jour dans la barre des tâches** (`#taskbar-update`) : visible uniquement quand une action est requise, avec les états `checking`, `available`, `updating` et `error`, une pastille d'alerte et une distinction par couleur (aucune animation). Un clic ouvre Paramètres directement sur la vue Mise à jour.
- **Avatars hors ligne** : l'avatar Kyros est d'abord lu dans un Cache Storage dédié (`luma-avatar-v1`), puis rafraîchi depuis le réseau en arrière-plan. Les bytes personnels ne traversent jamais le cache partagé du Service Worker, seules les réponses 200 de type image sont écrites, et la copie est purgée à la déconnexion ou au changement de compte. La balise d'émet plus de `src` immédiat : une session non authentifiée n'émet donc plus de requête — et plus de 401 — sur `/api/users/me/avatar`.
- **API de mise à jour exposée** : `window.LumaSwUpdate` gère désormais `subscribe`, `refresh`, `requestAssets` et `getState` enrichi (`phase`, `currentVersion`, `targetVersion`, `lastCheckedAt`, `assets`) ; le Service Worker répond aux messages `PING` et `GET_ASSETS`.

### Changements

- **Service Worker** : le HTML, le JavaScript et le CSS passent en **Network First** avec repli sur le cache hors ligne ; les images et polices restent en Cache First. La purge à l'activation ne concerne plus que les caches `luma-shell-*`, les autres caches du domaine sont préservés. `skipWaiting()` n'est plus appelé à l'installation.
- **Shell** : l'enregistrement du Service Worker est délégué au module de mise à jour ; `window.LumaOS.saveSession()` sauvegarde la session localement et à distance (`fetch` avec `keepalive`) avant un rechargement. La barre des tâches abrite un indicateur de mise à jour piloté par `window.LumaSwUpdate.subscribe()`.
- **Gestionnaire des tâches** : l'onglet Démarrage est supprimé ; la configuration des applications au démarrage vit dans Paramètres > Démarrage.
- Le shell lit désormais les réglages de démarrage côté serveur (`/api/users/me/settings`) ; la liste `localStorage["luma.startup-apps"]` est migrée une fois vers le serveur puis supprimée.

### Correctifs

- **401 sur `/api/users/me/avatar`** : l'écran de session affichait l'avatar du dernier compte connu alors qu'aucune session n'était active, ce qui déclenchait un appel systématiquement refusé. Le `src` n'est plus émis avant la résolution : l'initiale s'affiche immédiatement et le réseau n'est sollicité que pour un compte réellement connecté.
- **Applications bloquées résiduelles** : les listes d'applications transmises aux applications au montage (`apps` et `registry`) excluent désormais les applications masquées (`hidden`) et incompatibles — le Terminal, Paramètres et tout consommateur futur ne peuvent plus afficher Sonora Studio, BrainDump, Alimentation ou les apps masquées. Un épinglage restauré depuis `localStorage` filtre de la même façon.
- **Menu Démarrer périmé après un déploiement** : les applications bloquées réapparaissaient lorsque le Service Worker précédent (cache-first) servait encore l'ancien bundle. La mise à jour automatique du Service Worker (notification « Mettre à jour ») remplace ce bundle obsolète ; scénario reproduit et couvert par `npm run test:sw`.

---

## 3.2.0-alpha — Survol

> Stabilité de session, SSO v4, profil synchronisé, apps incompatibles et Narra.

- **Session durable** : la session ne saute plus lors d'un changement de réglage (magasin de sessions en SQLite, nodemon n'ignore plus les écritures de configuration).
- **SSO Kyros v4** : Luma OS parle désormais le protocole SSO v4 (PAR + PKCE S256, jetons RS256 vérifiés via JWKS, validation `iss` RFC 9207).
- **Profil synchronisé** : avatar Kyros affiché partout (écran de session, Paramètres, Gestionnaire des tâches) et profil aller-retour (nom, langue, fuseau) entre Kyros et Luma.
- **Narra** : A.R.C. devient Narra dans Luma Orbit.
- **Apps incompatibles** : Sonora Studio, BrainDump et Harmonix sont marqués « Incompatible » et ne peuvent plus être lancés.
- **Alimentation** retirée du menu Démarrer (l'accès reste disponible via l'indicateur de batterie).
- **Documentation externe** : `docs/API-EXTERNE.md` décrit le contrat SSO v4 et le profil synchronisable.

## 3.2.0-alpha — Détails

### Ajouts

- **SSO Kyros v4** : `KYROS_SSO_VERSION=v4` est le défaut. `GET /auth/login` effectue un POST `/par` (PKCE S256) puis redirige vers `/authorize` avec le `request_uri` ; `/auth/callback` valide `iss` (RFC 9207) et échange le code avec `code_verifier` ; les jetons d'accès RS256 sont vérifiés via le JWKS public (`kid` → clé, cache 5 minutes) avec `sso_version: "v4"`, issuer, audience et resource audience. Le mode v3 HS256 reste disponible.
- **Avatar Kyros** : l'avatar du compte est proxifié (`GET /api/users/me/avatar`) et affiché sur l'écran de session, dans Paramètres (identité du compte) et dans le Gestionnaire des tâches, avec repli sur l'initiale du nom.
- **Synchronisation de profil aller-retour** (scope `profile`) :
  - *Pull* : à chaque login et refresh, Luma compare le profil du jeton au dernier snapshot ; si le profil Kyros a changé, le nom préféré, la langue et le fuseau locaux suivent (`syncProfile` actif). Le premier passage initialise le snapshot sans écraser les préférences locales.
  - *Push* : `PATCH /api/users/me/account` pousse nom/langue/fuseau vers Kyros ; un échec remonte un avertissement (`profileSyncWarning`) sans perdre la sauvegarde locale. Le snapshot interne (`lastProfileSync`) n'est jamais exposé dans l'API.
- `docs/API-EXTERNE.md` : contrat externe SSO v4, endpoints de profil (`GET`/`PATCH /api/me/profile`) et règles de synchronisation.

### Correctifs

- Les sessions sont persistées en SQLite (`auth_sessions`) au lieu du magasin en mémoire : un redémarrage du serveur (nodemon) ne déconnecte plus l'utilisateur. Le refresh Kyros est « single-flight » (un seul rafraîchissement partagé par token) et la session n'est détruite que sur `invalid_grant` (les timeouts réseau la conservent).
- `nodemon.json` : les écritures dans `data/settings`, `data/accounts`, `data/sessions` et `data/luma.sqlite` ne redémarrent plus le serveur.

### Changements

- Luma Orbit : l'entrée A.R.C. devient **Narra** (porte d'entrée future vers les services Narra).
- Sonora Studio, BrainDump et Harmonix sont marqués **Incompatible** : fiche Orbit « Incompatible », bouton d'action désactivé, lancement bloqué, exclusion du menu Démarrer et des restaurations de session ; le lecteur Harmonix est masqué et `luma.harmonix.enabled` forcé à `false` ; le registre serveur les marque `enabled: false`.
- Alimentation n'apparaît plus dans le menu Démarrer (toujours accessible par le bouton batterie de la barre des tâches).

---

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
