# Migration de WinMa vers Luma OS

## État actuel

La première tranche de migration est en place : le nouveau serveur Express est le point d'entrée npm, tandis que le frontend historique reste servi depuis `sources/`. Le nom public devient Luma OS ; le nom du répertoire Git peut rester WinMa sans impact fonctionnel.

## Fichiers remplacés ou déplacés

| Ancien élément | Remplacement actuel | État |
| --- | --- | --- |
| `app.js` | `src/server/app.js` et `src/server/server.js` | Nouveau point d'entrée actif ; ancien fichier conservé |
| Formulaire identifiant/mot de passe | Redirection `/auth/login` vers Kyros | Remplacé |
| `localStorage.UserData` | Cookie de session opaque et `/api/session` | Remplacé |
| `/data/write/user` | Profil Kyros minimal en mémoire de session | Supprimé du nouveau serveur |
| `/data/user/params` | `GET /api/users/me/settings` | Remplacé |
| `/data/user/params/write` | `PATCH /api/users/me/settings` | Remplacé |
| Liste d'applications codée dans le HTML | `data/apps.json` et `/api/apps` | Registre créé, rendu du shell encore à migrer |

## Authentification

Le navigateur ne collecte plus le mot de passe. Luma OS :

1. génère un `state` aléatoire lié à la session ;
2. redirige vers Kyros `/authorize` ;
3. vérifie le callback et échange le code côté serveur ;
4. valide le JWT HS256, l'émetteur, l'audience globale, `resource_aud`, `client_id`, les scopes et l'expiration ;
5. conserve les tokens dans un magasin de session en mémoire ;
6. renouvelle l'access token avec rotation du refresh token ;
7. révoque le refresh token lors de la déconnexion.

Le magasin mémoire convient au développement personnel actuel. Un magasin de production persistant et maîtrisé reste obligatoire avant un déploiement multi-instance.

## Paramètres

Les paramètres sont associés au `sub` Kyros après transformation par SHA-256. Le client ne fournit plus d'identifiant utilisateur. Les patchs sont limités à `wallpaper`, `theme` et `accentColor`, puis écrits atomiquement dans `data/settings/`.

Les anciens dossiers `users/` ne sont pas lus par le nouveau serveur. Une migration future pourra extraire uniquement les fonds d'écran autorisés. Les fichiers d'informations utilisateur complets ne doivent pas être migrés.

## Compatibilité temporaire

- Les fonds d'écran et icônes historiques restent en place.
- Le bureau, le menu, les fenêtres et leurs scripts historiques restent chargés.
- Paramètres utilise déjà la nouvelle API sécurisée.
- Les anciennes routes `/data/*` ne sont plus exposées par `npm start`.
- Axios reste chargé temporairement pour les fragments hérités ; les nouveaux modules utilisent `fetch`.
- La CSP autorise temporairement les attributs de script inline requis par l'ancien menu. Cette exception doit disparaître lors de la migration du shell.

## Étapes restantes

1. créer l'application Luma OS dans Kyros et tester le SSO réel ;
2. faire choisir puis documenter la nouvelle direction visuelle ;
3. construire le gestionnaire de fenêtres centralisé ;
4. générer le bureau, le menu et la barre des tâches depuis le registre ;
5. compléter Paramètres avec thème et accent ;
6. retirer Axios, les `onclick` inline et l'exception CSP associée ;
7. migrer ou supprimer explicitement les données historiques ;
8. retirer `app.js` et les scripts hérités après validation de parité.

