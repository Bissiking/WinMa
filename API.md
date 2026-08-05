## Modifications réalisées

Aucune modification : analyse en lecture seule du backend Nino, du frontend et de Kyros.

### Fonctionnement actuel de Nino avec Kyros

Nino utilise une **connexion directe déléguée**, pas un SSO avec redirection.

```text
Navigateur
   │ identifiant + mot de passe
   ▼
Backend Nino ── client_id + client_secret + credentials ──▶ Kyros /token
   ▲                                                        │
   └──────── access_token JWT + refresh_token ──────────────┘
   │
   ▼
Frontend Nino
```

Le déroulement exact est le suivant :

1. Le frontend envoie `username` et `password` à `POST /api/v1/auth/login`.
2. Le backend Nino ajoute ses secrets applicatifs et appelle Kyros :

```json
{
  "grant_type": "password",
  "client_id": "cli_nino",
  "client_secret": "...",
  "username": "matheo",
  "password": "...",
  "scope": "profile email"
}
```

3. Kyros authentifie l’utilisateur et vérifie que l’application, l’entreprise et les permissions permettent l’accès.
4. Kyros renvoie un `access_token` JWT court et un `refresh_token` opaque.
5. Nino vérifie le JWT, synchronise l’utilisateur dans sa base, puis transmet la paire de tokens au frontend.

L’implémentation de l’échange se trouve dans [kyros.py](/Users/matheohemery/Documents/GitHub/nino-backend/app/services/kyros.py:34). L’appel du frontend est dans [api.ts](/Users/matheohemery/Documents/GitHub/nino-frontend/lib/api.ts:50).

### Validation des tokens

Pour chaque route protégée, le frontend envoie :

```http
Authorization: Bearer <access_token>
```

Le backend valide localement :

- la signature `HS256` ;
- `iss` : émetteur Kyros ;
- `aud` : audience générale ;
- `resource_aud` : audience propre à Nino ;
- `client_id` ;
- `scope` ;
- `iat` et `exp`.

Cette validation est dans [kyros.py](/Users/matheohemery/Documents/GitHub/nino-backend/app/services/kyros.py:100) et son branchement FastAPI dans [deps.py](/Users/matheohemery/Documents/GitHub/nino-backend/app/api/deps.py:15).

`resource_aud` est particulièrement important : il empêche qu’un token émis pour une autre application Kyros soit accepté par Nino.

### Synchronisation locale

Kyros reste propriétaire de l’identité, mais Nino conserve ses données métier.

À partir du JWT, Nino :

- cherche l’utilisateur par `sub`/`kyros_subject` ;
- peut rattacher un ancien compte ayant la même adresse email ;
- met à jour email, nom et statut administrateur ;
- crée un utilisateur local si nécessaire ;
- crée un profil Nino par défaut.

Les profils, vidéos, progressions et notifications restent donc dans Nino. Voir [kyros.py](/Users/matheohemery/Documents/GitHub/nino-backend/app/services/kyros.py:60).

### Renouvellement

Nino expose `POST /api/v1/auth/refresh`, qui transmet à Kyros :

```json
{
  "grant_type": "refresh_token",
  "client_id": "cli_nino",
  "client_secret": "...",
  "refresh_token": "..."
}
```

Kyros effectue une rotation : le nouveau refresh token doit systématiquement remplacer l’ancien. Le backend le fait correctement dans [kyros.py](/Users/matheohemery/Documents/GitHub/nino-backend/app/services/kyros.py:48).

En revanche, le frontend Nino **n’appelle pas encore automatiquement cette route** : au premier `401`, il vide la session et renvoie vers la connexion.

### Modes disponibles

Le backend possède trois modes dans [auth.py](/Users/matheohemery/Documents/GitHub/nino-backend/app/services/auth.py:15) :

- `local` : authentification Nino uniquement ;
- `kyros` : authentification Kyros uniquement ;
- `hybrid` : tentative Kyros, puis compte local si les identifiants Kyros sont invalides.

Le mode `hybrid` est principalement utile pendant une migration.

### Pour tes autres projets

Je ne recopierais pas exactement le modèle Nino. Kyros recommande plutôt le **SSO par code d’autorisation** :

```text
Projet → redirection /authorize chez Kyros
Kyros → connexion centralisée
Kyros → callback du projet avec un code temporaire
Backend du projet → échange du code sur /token
Backend → session sécurisée pour le navigateur
```

Pour chaque nouveau projet :

1. Créer une application distincte dans l’administration Kyros.
2. Choisir `sso` — ou `hybrid` si la connexion directe est réellement nécessaire.
3. Déclarer les callback URLs et domaines autorisés.
4. Définir des scopes propres, par exemple `profile email projet:read`.
5. Utiliser une audience propre, par exemple `kyros:sso:projet`.
6. Garder `client_secret` exclusivement dans le backend.
7. Vérifier signature, issuer, audience, `resource_aud`, scopes et expiration sur chaque API.
8. Conserver idéalement le refresh token côté serveur ou dans un cookie `HttpOnly`, `Secure` et `SameSite`.
9. Prévoir rotation, révocation et déconnexion.

La documentation Kyros prévue pour ce cas est [ai-auth-quickstart.md](/Users/matheohemery/Documents/GitHub/kyros/docs/ai-auth-quickstart.md:15).

## Tests exécutés

Aucun test : aucune modification n’a été réalisée.

## Tests non exécutés

La connexion réelle à une instance Kyros n’a pas été testée ; l’analyse porte sur les contrats et le code présents dans les trois dépôts.

## Migrations nécessaires

Aucune.

## Impacts frontend

Le frontend Nino :

- présente son propre formulaire de connexion ;
- voit passer le mot de passe utilisateur ;
- conserve access token et refresh token dans `localStorage` ;
- n’effectue pas encore de refresh automatique.

Le stockage est visible dans [session.ts](/Users/matheohemery/Documents/GitHub/nino-frontend/lib/session.ts:3).

## Risques restants

- Le refresh token dans `localStorage` est exposé en cas de XSS.
- La connexion directe fait transiter le mot de passe par le backend Nino.
- Le frontend ne renouvelle pas automatiquement la session.
- La déconnexion locale ne révoque pas le refresh token chez Kyros.
- Nino transforme directement `role == "admin"` dans le JWT en administrateur Nino ; pour d’autres projets, mieux vaut utiliser une permission applicative spécifique.
- Le fichier obligatoire `NINO_CODEX_CONTEXT.md` n’était présent ni dans le backend ni dans le frontend.