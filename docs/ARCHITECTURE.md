# Architecture cible de Luma OS

## Objectif

Faire évoluer le prototype historique WinMa sans « big bang » vers Luma OS, un bureau web LUMA modulaire, testable et sécurisé, en conservant Node.js, Express, HTML, CSS et JavaScript natif. jQuery reste autorisé pour le code hérité mais les nouveaux modules peuvent utiliser les API natives du navigateur.

## Principes

1. Le backend est l'unique frontière de confiance.
2. L'identité appartient à Kyros ; WinMa ne collecte jamais le mot de passe.
3. Le navigateur ne reçoit qu'une session opaque et un profil utilisateur minimal.
4. Les applications sont déclarées dans un registre, jamais ouvertes depuis un chemin arbitraire.
5. Une fenêtre possède son propre état ; le DOM est une projection de cet état.
6. Les paramètres sont lus pour l'utilisateur de la session et modifiés par patch ciblé.
7. La migration garde l'ancien prototype exécutable jusqu'au basculement de chaque sous-système.
8. Les fichiers Documents restent hors base ; seule leur métadonnée est persistée par un repository remplaçable.

## Arborescence recommandée

```text
WinMa/
├── src/
│   ├── server/
│   │   ├── app.js
│   │   ├── server.js
│   │   ├── config/
│   │   │   ├── env.js
│   │   │   └── security.js
│   │   ├── controllers/
│   │   │   ├── auth-controller.js
│   │   │   ├── apps-controller.js
│   │   │   ├── session-controller.js
│   │   │   └── settings-controller.js
│   │   ├── middlewares/
│   │   │   ├── error-handler.js
│   │   │   ├── not-found.js
│   │   │   ├── require-session.js
│   │   │   └── validate.js
│   │   ├── routes/
│   │   │   ├── api.js
│   │   │   ├── auth-routes.js
│   │   │   ├── apps-routes.js
│   │   │   ├── session-routes.js
│   │   │   └── settings-routes.js
│   │   ├── services/
│   │   │   ├── app-registry-service.js
│   │   │   ├── kyros-service.js
│   │   │   ├── session-service.js
│   │   │   └── settings-service.js
│   │   └── utils/
│   │       ├── api-response.js
│   │       ├── async-handler.js
│   │       └── logger.js
│   └── public/
│       ├── index.html
│       ├── apps/
│       │   ├── settings/
│       │   ├── services/
│       │   └── system-info/
│       └── assets/
│           ├── css/
│           │   ├── tokens.css
│           │   ├── base.css
│           │   ├── shell.css
│           │   └── components/
│           ├── fonts/
│           ├── icons/
│           ├── images/
│           └── js/
│               ├── api-client.js
│               ├── app-registry.js
│               ├── desktop.js
│               ├── session.js
│               ├── start-menu.js
│               ├── taskbar.js
│               └── window-manager.js
├── data/
│   ├── apps.json
│   ├── settings/
│   └── services.json
├── docs/
├── tests/
│   ├── integration/
│   └── unit/
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

`src/server/app.js` construit et exporte l'application Express sans ouvrir de port, afin de permettre les tests. `src/server/server.js` charge la configuration puis écoute le port.

## Authentification Kyros

### Flux retenu : SSO par code d'autorisation

```text
Navigateur                  Backend WinMa                      Kyros
    | GET /auth/login             |                              |
    |---------------------------->| génère state + session       |
    |<----------------------------| redirection /authorize       |
    |------------------------------------------------------------>|
    |                 connexion centralisée chez Kyros            |
    |<------------------------------------------------------------|
    | GET /auth/callback?code&state                              |
    |---------------------------->| vérifie state                 |
    |                             | POST /token (secret serveur)  |
    |                             |------------------------------>|
    |                             |<------------------------------|
    |<----------------------------| rotation session + redirect / |
    | GET /api/session, cookie HttpOnly                           |
    |---------------------------->|                              |
```

Le flux direct par identifiant/mot de passe n'est pas retenu pour WinMa : Kyros possède désormais l'écran de connexion. Le formulaire `session-select` devient un écran d'accueil/verrouillage avec un bouton « Se connecter avec Kyros ».

### Règles de session

- Le `client_secret` existe uniquement dans l'environnement du serveur.
- Le `state` est aléatoire, lié à la session, à durée de vie courte et consommé une seule fois.
- Le code est échangé côté serveur avec exactement la même `redirect_uri`.
- `access_token` et `refresh_token` ne sont jamais placés dans `localStorage`, `sessionStorage`, l'URL ou une réponse API frontend.
- Le navigateur reçoit un cookie de session opaque : `HttpOnly`, `SameSite=Lax`, `Secure` en production, nom non générique et durée bornée.
- Les tokens Kyros sont conservés dans un magasin de session serveur. Le magasin de production doit être explicite et ne doit pas reposer sur le `MemoryStore` d'Express.
- Lors d'un renouvellement, le refresh token rotatif remplace l'ancien de manière atomique.
- Une session est refusée si l'audience de ressource, le `client_id`, les scopes, l'émetteur ou l'expiration attendus ne correspondent pas.
- La déconnexion révoque le refresh token auprès de Kyros puis détruit la session Luma OS, même si la révocation distante échoue.
- La rotation de l'identifiant de session est obligatoire après le callback pour prévenir la fixation de session.

### Configuration attendue

```dotenv
NODE_ENV=development
HOST=127.0.0.1
PORT=3000
APP_BASE_URL=http://localhost:3000
SESSION_SECRET=replace-with-at-least-32-random-bytes
KYROS_BASE_URL=https://kyros.example.test
KYROS_CLIENT_ID=cli_winma
KYROS_CLIENT_SECRET=replace-me
KYROS_CALLBACK_URL=http://localhost:3000/auth/callback
KYROS_SCOPES=profile email winma:access
KYROS_RESOURCE_AUDIENCE=kyros:sso:winma
```

Les valeurs réelles ne sont jamais versionnées. La configuration démarre en erreur si une variable requise manque ou si une URL n'utilise pas HTTPS en production.

### Profil exposé au frontend

```json
{
  "id": "usr_x",
  "username": "matheo",
  "displayName": "Matheo",
  "avatar": "default"
}
```

Email, rôles et permissions ne sont ajoutés que si une fonctionnalité WinMa les exige. Les décisions d'autorisation sont prises côté serveur à partir des claims validés, pas à partir d'un rôle envoyé par le navigateur.

## API HTTP

Toutes les réponses JSON utilisent une enveloppe stable.

```json
{
  "success": true,
  "data": {},
  "message": null
}
```

| Méthode | Route | Session | Rôle |
| --- | --- | --- | --- |
| `GET` | `/auth/login` | Non | Démarre le SSO Kyros |
| `GET` | `/auth/callback` | En cours | Valide le retour Kyros |
| `POST` | `/api/auth/logout` | Oui | Détruit la session |
| `GET` | `/api/session` | Non | Retourne l'état et le profil minimal |
| `GET` | `/api/users/me/settings` | Oui | Lit les paramètres du compte courant |
| `PATCH` | `/api/users/me/settings` | Oui | Modifie uniquement les champs fournis |
| `GET` | `/api/apps` | Oui | Retourne les applications autorisées |
| `GET` | `/api/apps/:appId` | Oui | Retourne une application autorisée |
| `GET` | `/api/users/me/account` | Oui | Retourne identité Kyros, préférences Luma, quota et état de synchronisation |
| `PATCH` | `/api/users/me/account` | Oui | Met à jour uniquement le profil Luma local |
| `GET` | `/api/users/me/context` | Oui | Fournit aux modules le contexte explicitement partageable |
| `GET` | `/api/services` | Oui | Retourne les services visibles |
| `GET` | `/api/documents` | Oui | Liste, recherche ou ouvre la Corbeille |
| `POST` | `/api/documents/folders` | Oui | Crée un dossier |
| `POST` | `/api/documents/upload` | Oui | Importe un fichier après contrôle du quota |
| `PATCH` | `/api/documents/:id` | Oui | Renomme ou déplace un élément |
| `GET` | `/api/documents/:id/download` | Oui | Télécharge un fichier appartenant au sujet |
| `POST` | `/api/documents/actions/*` | Oui | Supprime, restaure ou vide la Corbeille |

Les anciennes routes `/data/write/user`, `/data/user/params` et `/data/user/params/write` sont maintenues uniquement pendant une courte période de transition locale, puis supprimées dès que leurs consommateurs utilisent les nouvelles routes. Elles ne doivent jamais être exposées en production.

## Registre des applications

`data/apps.json` constitue la source de vérité serveur. Le frontend reçoit une version filtrée.

```json
{
  "id": "settings",
  "name": "Paramètres",
  "icon": "/assets/icons/settings.svg",
  "entry": "/apps/settings/index.html",
  "type": "internal",
  "enabled": true,
  "pinned": true,
  "window": {
    "width": 920,
    "height": 680,
    "minWidth": 360,
    "minHeight": 300
  }
}
```

Types autorisés :

- `internal` : fragment ou page locale contrôlée ;
- `iframe` : origine présente dans une liste autorisée et iframe munie d'une sandbox minimale ;
- `external` : ouverture explicite dans un nouvel onglet avec `noopener,noreferrer` ;
- `system` : application native du shell WinMa.

Le serveur valide `appId` contre ce registre. Aucun chemin ou URL fourni par le client n'est chargé directement.

## Gestionnaire de fenêtres

Le gestionnaire conserve une `Map` d'états et émet un événement unique après chaque transition.

```js
{
  id: "window-uuid",
  appId: "settings",
  title: "Paramètres",
  icon: "/assets/icons/settings.svg",
  bounds: { x: 64, y: 48, width: 920, height: 680 },
  restoreBounds: null,
  zIndex: 3,
  status: "normal",
  active: true
}
```

`status` vaut `normal`, `minimized` ou `maximized`. Les opérations publiques sont `open`, `close`, `focus`, `move`, `resize`, `minimize`, `maximize`, `restore` et `toggleFromTaskbar`. Pointer Events servent la souris, le stylet et le tactile. Sur petit écran, l'ouverture plein écran est la règle et les poignées de redimensionnement sont masquées.

Le shell, la barre des tâches et les fenêtres consomment le même état ; aucun composant ne déduit l'état uniquement depuis le DOM.

## Paramètres utilisateur

Schéma initial :

```json
{
  "wallpaper": "./images/backgrounds/luma-aurora.webp",
  "theme": "luma",
  "accentColor": "#6d5ee8",
  "density": "comfortable",
  "motion": "system"
}
```

- Le chemin de stockage est calculé depuis le sujet Kyros validé, jamais depuis une valeur du corps de requête.
- Le sujet est transformé en clé sûre ou hash déterministe avant utilisation comme nom de fichier.
- `PATCH` accepte une liste blanche de champs et fusionne avec les valeurs existantes.
- L'écriture utilise un fichier temporaire puis un renommage atomique.
- Les valeurs de fond et de thème sont validées contre les options autorisées.
- Une corruption JSON retourne une erreur contrôlée sans écraser les données.

## Documents et Corbeille

- `better-sqlite3` conserve en développement l’arborescence, le propriétaire hashé, le type, la taille, le chemin opaque et les dates.
- Les contenus sont enregistrés sous des noms UUID dans `storage/documents/<owner-hash>/`; leur nom utilisateur reste une métadonnée.
- Le quota de 1 Gio est calculé côté serveur et inclut la Corbeille jusqu’à suppression définitive.
- Les mutations contrôlent systématiquement le propriétaire issu de la session Kyros et refusent les cycles de dossiers.
- La Corbeille groupe un dossier avec ses descendants, permet la restauration, et purge les groupes supprimés depuis 30 jours.
- La couche `sqlite-document-repository` doit devenir une implémentation d’interface lorsqu’un repository PostgreSQL sera ajouté en production.

## Compte et contexte inter-modules

- Kyros reste la source de vérité de l’identifiant, du nom de compte et de la session ; Luma OS ne prétend pas les modifier sans contrat Kyros dédié.
- `account-service` persiste atomiquement, par sujet hashé, le nom préféré Luma, la langue, le fuseau horaire et deux consentements de synchronisation.
- `/api/users/me/context` retourne un schéma versionné. `profile` ou `appearance` vaut `null` lorsque l’utilisateur désactive la catégorie correspondante.
- Réseau Luma décrit la connectivité applicative locale (hôte, session Kyros, Documents, registre et contexte partagé), jamais l’état Wi-Fi de l’appareil.

## Sécurité du serveur

- Helmet avec CSP adaptée aux actifs locaux et aux iframes autorisées.
- Limite stricte des corps JSON et désactivation d'`urlencoded` si aucune route n'en a besoin.
- Limitation des requêtes sur les routes d'authentification et de callback.
- Validation de configuration et des entrées à la frontière HTTP.
- Origines et proxy de confiance configurés explicitement.
- Journalisation structurée avec identifiant de requête et masquage des secrets.
- Gestionnaire d'erreurs unique ; aucun détail interne renvoyé en production.
- Dépendances mises à jour et audit automatisé en intégration continue.

## Stratégie frontend

- Une page shell unique contient les zones stables : bureau, fenêtres, barre des tâches, menu principal et annonces d'état.
- Les modules JavaScript sont chargés avec `type="module"` pour limiter les variables globales.
- Les composants utilisent des classes préfixées (`wm-`, `taskbar-`, `start-`, `settings-`) et des variables CSS.
- Les actions sont des boutons sémantiques ; le clavier et le focus suivent les mêmes transitions que la souris.
- Le chargement d'une application passe uniquement par le registre.
- Les animations sont courtes et supprimées sous `prefers-reduced-motion`.

## Easter eggs

Le bureau LUMA cache quelques applications derrière des commandes du Terminal. Elles n'apparaissent ni dans le menu Démarrer, ni dans la liste `apps` du Terminal, mais restent ouvrèables.

| Application | Déclencheur | Où |
| --- | --- | --- |
| **Matheo Systems** (moniteur de « mode survie » de la workstation cognitive) | `sudo reboot` | Terminal (`sources/apps/terminal/app.js`) |

### Ajouter un easter egg

1. Masquer l'application dans le registre du shell : `sources/assets/javascripts/luma-shell.js`, ajouter `hidden: true` à sa définition (ex. `{ id: "matheo-systems", …, hidden: true }`).
   - `hidden: true` la retire du menu Démarrer (`renderStartApps`) et de la liste `apps` transmise aux applications, sans bloquer `openApp()`.
2. Déclencher son ouverture depuis le Terminal : dans `sources/apps/terminal/app.js`, ajouter un `case` au `switch` de `run()`, qui appelle `open("<id>")` (la fonction `open` du contexte est `openApp` du gestionnaire de fenêtres). Ne pas l'ajouter à `COMMANDS` pour qu'elle reste secrète et absente de `help`.
3. Mettre à jour ce tableau.

## Migration sans rupture

1. Construire le nouveau serveur et ses tests à côté de `app.js`.
2. Servir encore l'ancien frontend depuis `sources/` tant que le nouveau shell n'est pas prêt.
3. Introduire le SSO Kyros et `/api/session`, puis retirer le formulaire et `localStorage.UserData`.
4. Introduire le registre et faire migrer les ouvertures d'applications une par une.
5. Remplacer le gestionnaire de fenêtres, puis brancher la barre des tâches.
6. Migrer les paramètres et les données non sensibles depuis `users/`.
7. Basculer la racine statique vers `src/public/` seulement après tests de parité.
8. Archiver ou supprimer le code hérité dans une migration distincte et documentée.
