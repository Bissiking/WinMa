# API externe Luma OS / Kyros

Contrat destiné aux modules et clients externes de l'écosystème (Luma OS, applications internes, futurs clients PAT). Les endpoints décrits ici sont stables ; tout le reste du serveur Luma est interne et peut changer sans préavis.

## Authentification SSO v4

Luma OS authentifie ses utilisateurs par code d'autorisation Kyros (RFC 9207) avec PKCE S256 :

1. `GET /auth/login` (Luma) → `POST {KYROS_BASE_URL}/par` → redirection vers `{KYROS_BASE_URL}/authorize?client_id=…&request_uri=…`.
2. `GET /auth/callback` (Luma) : `code` + `state` + `iss` (RFC 9207) → `POST {KYROS_BASE_URL}/token` (`grant_type=authorization_code`, `code_verifier`).
3. Refresh : `POST {KYROS_BASE_URL}/token` (`grant_type=refresh_token`, rotation).

Scopes demandés par Luma OS : `profile email offline_access`.

- Le scope **`profile`** autorise la lecture **et** l'écriture du profil synchronisable (voir ci-dessous). Il n'existe pas de `profile:write` séparé : une application déclarée avec `profile` peut lire et écrire le profil de son utilisateur.
- Les jetons d'accès sont RS256 (JWKS public `GET {KYROS_BASE_URL}/sso/v4/jwks`), avec `sso_version: "v4"`, `iss`, `aud`, `resource_aud` et `client_id`.

## Profil synchronisable (scope `profile`)

Ces endpoints servent la synchronisation de profil Luma OS ↔ Kyros (aller-retour complet) et tout client Bearer avec le scope `profile`.

### `GET /api/me/profile`

Lit le profil synchronisable de l'utilisateur du jeton.

```json
{
  "display_name": "Mathéo",
  "locale": "fr-FR",
  "timezone": "Europe/Paris",
  "avatar_url": "/assets/uploads/avatars/avatar-abc.png"
}
```

Les champs absents côté Kyros sont `null`. `Cache-Control: no-store`.

### `PATCH /api/me/profile`

Met à jour le profil. Corps JSON (tous les champs sont facultatifs) :

```json
{ "displayName": "Mathéo", "locale": "fr-FR", "timezone": "Europe/Paris" }
```

Réponse : `200` avec `{ "display_name", "locale", "timezone" }`.

Validations :

| Champ | Règle |
| --- | --- |
| `displayName` | 1–100 caractères, lettres/espaces/`.` `’` `-` (unicode) |
| `locale` | BCP 47 simple (`fr-FR`, `en-US`, …), max 35 caractères |
| `timezone` | Identifiant IANA valide (`Intl.DateTimeFormat`) |

Erreurs : `400 { "error": "invalid_profile", "fields": ["locale", …] }`, `401` sans jeton valide, `403` sans scope `profile`. Chaque écriture est journalisée (`auth_audit_events`, type `profile_updated`).

## Synchronisation de profil dans Luma OS

- **Pull (Kyros → Luma)** : à chaque login et refresh de session, Luma compare le profil du jeton au dernier snapshot (`lastProfileSync`). Si le profil Kyros a changé, les préférences locales (`preferredName`, `language`, `timeZone`) suivent, sous réserve que `syncProfile` soit actif. Le premier passage initialise le snapshot sans écraser les préférences locales.
- **Push (Luma → Kyros)** : l'enregistrement des préférences de compte (`PATCH /api/users/me/account`) pousse `displayName`/`locale`/`timezone` vers `PATCH /api/me/profile` (meilleur effort, jeton de la session). Un échec remonte `profileSyncWarning` dans la réponse : la sauvegarde locale est conservée et le snapshot reste inchangé (nouvelle tentative au prochain enregistrement).
- Les jetons d'accès émis après un push doivent refléter le profil mis à jour (sinon le prochain refresh interpréterait l'ancien état comme un changement et écraserait la préférence locale).

## À venir (non contractuel)

- Jetons d'accès personnels (PAT) pour les clients non-navigateurs.
- CalDAV / CardDAV (contacts et calendriers).
