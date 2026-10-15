# Sauvegarde, export et restauration

Luma OS exporte vos données personnelles dans un fichier JSON unique et sait les restaurer. La vue dédiée se trouve dans **Paramètres > Sauvegarde**. Les sauvegardes serveur PostgreSQL (infra) sont un sujet distinct : [`docs/DATABASE.md`](DATABASE.md).

## Périmètre

**Inclus dans la sauvegarde** :

| Donnée | Origine |
| --- | --- |
| Paramètres du bureau (thème, fond, démarrage, verrouillage…) | Serveur (`/api/users/me/settings`) |
| Préférences de compte (nom préféré, langue, fuseau, consentements) | Serveur (`/api/users/me/account`) |
| Disposition du bureau (fenêtres ouvertes, position, état) | Serveur (`window_sessions`) |
| Notes texte / Markdown (Documents) | Serveur, sous forme de chemins relatifs + contenu |
| Données locales du navigateur : événements du Calendrier, applications Orbit épinglées/ installées, épingles de la barre des tâches, volume… | Navigateur (`localStorage`, section `browser`) |

**Jamais inclus** : les fichiers binaires (images, vidéos, musiques, PDF…) — ils restent stockés côté serveur dans `storage/documents/` et ne sont ni copiés ni supprimés par l'export, l'import ou la réinitialisation. Les jetons de session, secrets et données Kyros ne quittent jamais le serveur.

## Format du fichier

```jsonc
{
  "format": "luma-backup",        // marqueur obligatoire
  "schemaVersion": 1,             // version du schéma (migration si incompatible)
  "exportedAt": "2026-10-15T14:30:00.000Z",
  "version": "3.3.0",             // version de Luma OS à l'export
  "server": {
    "settings": { "theme": "dark", "accentColor": "#6d5ee8", ... },
    "account": { "preferredName": "Matheo", "preferredLanguage": "fr", ... },
    "windows": [ { "id": "...", "appId": "notepad", "name": "Bloc-notes", "state": "normal", ... } ],
    "notes": [ { "path": "Notes de travail/brouillon.md", "content": "# Brouillon" } ]
  },
  "browser": { "luma.calendar.events": [...], "luma.orbit.pinned": [...], ... }
}
```

Les chemins de notes sont relatifs à l'espace Documents personnel : le premier segment est un dossier (recréé si absent), un chemin sans dossier est une note de racine. Contrôles serveur à l'import : profondeur maximale 8 segments, aucun `..`, aucun caractère interdit, 500 notes maximum, 1 Mo par note et 5 Mo au total.

## Exporter

1. Ouvrez **Paramètres > Sauvegarde**.
2. Cliquez sur **Télécharger la sauvegarde**.
3. Le fichier `luma-sauvegarde-AAAA-MM-JS.json` est téléchargé. Conservez-le hors ligne : il constitue votre sauvegarde personnelle.

## Restaurer

1. Ouvrez **Paramètres > Sauvegarde**.
2. Cliquez sur **Choisir un fichier** et sélectionnez un fichier de sauvegarde Luma OS (`.json`).
3. La restauration confirme par un toast puis recharge le bureau.

À l'import, **rien n'est supprimé** :

- les paramètres et préférences du fichier remplacent les valeurs actuelles ; les champs absents du fichier reviennent à leurs défauts ;
- les fenêtres du fichier remplacent la disposition actuelle ;
- une note portant le même chemin est mise à jour, une note inconnue est recréée avec ses dossiers ;
- les fichiers binaires déjà présents ne sont pas touchés.

Un fichier au format inconnu, à une version de schéma inconnue ou malformé est refusé sans effet de bord.

## Réinitialiser

La section **Réinitialiser** remet à zéro uniquement les catégories cochées : **Paramètres**, **Préférences du compte**, **Disposition du bureau** et **Notes** (suppression définitive des documents texte, fichiers binaires conservés). Le bouton exige une seconde confirmation pendant 6 secondes.

## API

| Méthode | Route | Description |
| --- | --- | --- |
| `GET` | `/api/users/me/backup` | Export complet (paramètres, compte, fenêtres, notes) |
| `POST` | `/api/users/me/backup` | Import d'un fichier (body JSON, 8 Mo maximum) |
| `POST` | `/api/users/me/backup/reset` | `{ "targets": ["settings", "account", "windows", "notes"] }` |

Les trois routes exigent une session authentifiée et le même origine. Codes d'erreur : `BACKUP_INVALID` (format ou contenu inconnu), `BACKUP_VERSION_UNSUPPORTED` (schéma), `BACKUP_NOTE_PATH_INVALID` (chemin de note), `BACKUP_NOTES_INVALID` / `BACKUP_NOTES_TOO_MANY` / `BACKUP_NOTES_TOO_LARGE` (limites), `BACKUP_PATH_CONFLICT` (chemin déjà occupé par un fichier binaire), `BACKUP_RESET_TARGET_INVALID` (cible de réinitialisation).

## Restauration sur une nouvelle machine

1. Installez et démarrez Luma OS (voir [`README.md`](../README.md)), connectez-vous avec Kyros.
2. Ouvrez **Paramètres > Sauvegarde**, importez votre fichier : les paramètres, le compte, la disposition et les notes sont restaurés.
3. Réimportez depuis Documents les fichiers binaires souhaités — ils n'étaient pas embarqués dans la sauvegarde.
